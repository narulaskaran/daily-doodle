import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Use a more capable model for holistic pattern analysis
const ANALYSIS_MODEL = "google/gemini-2.5-flash-preview";

interface GuidelineChange {
  action: "new" | "update";
  existingId?: string;
  guideline: string;
}

interface LearningAnalysis {
  analysis: string;
  diversityProblems: string[];
  guidelineChanges: GuidelineChange[];
}

async function runLLMAnalysis(prompt: string): Promise<LearningAnalysis | null> {
  const apiKey = process.env.OPEN_ROUTER_KEY;
  if (!apiKey) {
    console.error("OPEN_ROUTER_KEY not configured — skipping LLM analysis");
    return null;
  }

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = data.choices[0]?.message.content ?? "";

  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleaned) as LearningAnalysis;
  } catch {
    console.error("Failed to parse LLM analysis response:", raw.slice(0, 500));
    return null;
  }
}

function buildAnalysisPrompt(
  approved: { prompt: string; components: string }[],
  rejected: { prompt: string; components: string }[],
  guidelines: { id: string; guideline: string; occurrences: number }[],
): string {
  const fmtList = (items: { prompt: string; components: string }[]) =>
    items.length === 0
      ? "(none)"
      : items
          .map((item, i) => `${i + 1}. ${item.components || item.prompt.slice(0, 200)}`)
          .join("\n");

  const fmtGuidelines = (gs: { id: string; guideline: string; occurrences: number }[]) =>
    gs.length === 0
      ? "(none)"
      : gs.map((g) => `[ID: ${g.id}] (seen ${g.occurrences}x): ${g.guideline}`).join("\n");

  return `You are a quality analyst for a kawaii coloring book image generation system.

SYSTEM OVERVIEW:
- ~4 black-and-white kawaii coloring pages are AI-generated each day
- An admin reviews each image: approves good ones, rejects bad ones
- "Guidelines" are prepended to every generation prompt to enforce quality
- REPORTED PROBLEMS: Images look too similar to each other, and the same quality issues keep recurring despite existing guidelines

RECENT DATA (last 30 days):

APPROVED IMAGES (${approved.length} total):
${fmtList(approved)}

REJECTED IMAGES (${rejected.length} total):
${fmtList(rejected)}

CURRENT GUIDELINES:
${fmtGuidelines(guidelines)}

YOUR TASKS:
1. Identify patterns: What recurring elements or themes appear in rejected images that are absent from approved ones?
2. Detect similarity problems: Are the same animals, scenes, or action types being generated too frequently?
3. Check guideline effectiveness: Do any current guidelines appear to be ineffective (same issue recurring despite the rule)? If so, suggest a stronger version.
4. Suggest new guidelines that would reduce rejections or improve diversity. Only suggest guidelines grounded in actual patterns you see — do not invent problems.

RULES FOR GUIDELINE TEXT:
- Write as direct instructions to an image generation model (e.g., "Never include text or lettering in the image")
- 1–2 sentences max, specific and actionable
- For diversity rules: use "Vary the primary animal — avoid repeating the same animal type within the same week"

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "analysis": "2-3 sentence summary of patterns found",
  "diversityProblems": ["specific problem 1", "specific problem 2"],
  "guidelineChanges": [
    { "action": "new", "guideline": "Exact new guideline text" },
    { "action": "update", "existingId": "<id from above>", "guideline": "Improved guideline text" }
  ]
}`;
}

function describeComponents(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const comp = raw as { animal?: string; action?: string; scene?: string; props?: string };
  const parts = [comp.animal, comp.action, comp.scene].filter(Boolean);
  return parts.join(" / ");
}

async function runLearning(): Promise<{
  approved: number;
  rejected: number;
  analysisResult: LearningAnalysis | null;
  guidelinesCreated: number;
  guidelinesUpdated: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recentPages, existingGuidelines] = await Promise.all([
    db.coloringPage.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { approved: true, prompt: true, promptComponents: true },
      orderBy: { createdAt: "desc" },
    }),
    db.imageGuideline.findMany({
      select: { id: true, guideline: true, occurrences: true },
      orderBy: { occurrences: "desc" },
    }),
  ]);

  const approved = recentPages
    .filter((p) => p.approved === true)
    .map((p) => ({
      prompt: p.prompt ?? "",
      components: describeComponents(p.promptComponents),
    }));

  const rejected = recentPages
    .filter((p) => p.approved === false)
    .map((p) => ({
      prompt: p.prompt ?? "",
      components: describeComponents(p.promptComponents),
    }));

  if (approved.length + rejected.length < 3) {
    // Not enough data to draw meaningful conclusions
    return {
      approved: approved.length,
      rejected: rejected.length,
      analysisResult: null,
      guidelinesCreated: 0,
      guidelinesUpdated: 0,
    };
  }

  const analysisPrompt = buildAnalysisPrompt(approved, rejected, existingGuidelines);
  const result = await runLLMAnalysis(analysisPrompt);

  if (!result) {
    return {
      approved: approved.length,
      rejected: rejected.length,
      analysisResult: null,
      guidelinesCreated: 0,
      guidelinesUpdated: 0,
    };
  }

  let guidelinesCreated = 0;
  let guidelinesUpdated = 0;

  for (const change of result.guidelineChanges) {
    if (!change.guideline?.trim()) continue;

    if (change.action === "new") {
      await db.imageGuideline.create({
        data: { guideline: change.guideline.trim() },
      });
      guidelinesCreated++;
    } else if (change.action === "update" && change.existingId) {
      const exists = existingGuidelines.some((g) => g.id === change.existingId);
      if (exists) {
        await db.imageGuideline.update({
          where: { id: change.existingId },
          data: {
            guideline: change.guideline.trim(),
            occurrences: { increment: 1 },
          },
        });
        guidelinesUpdated++;
      }
    }
  }

  return {
    approved: approved.length,
    rejected: rejected.length,
    analysisResult: result,
    guidelinesCreated,
    guidelinesUpdated,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLearning();
    console.log("Nightly learning complete:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      imagesAnalyzed: { approved: result.approved, rejected: result.rejected },
      analysis: result.analysisResult?.analysis ?? "Insufficient data",
      diversityProblems: result.analysisResult?.diversityProblems ?? [],
      guidelinesCreated: result.guidelinesCreated,
      guidelinesUpdated: result.guidelinesUpdated,
    });
  } catch (error) {
    console.error("Nightly learning error:", error);
    return NextResponse.json(
      { error: "Learning job failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

// Also support POST for manual triggering from the admin panel
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLearning();
    console.log("Manual learning trigger complete:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      imagesAnalyzed: { approved: result.approved, rejected: result.rejected },
      analysis: result.analysisResult?.analysis ?? "Insufficient data",
      diversityProblems: result.analysisResult?.diversityProblems ?? [],
      guidelinesCreated: result.guidelinesCreated,
      guidelinesUpdated: result.guidelinesUpdated,
    });
  } catch (error) {
    console.error("Nightly learning error:", error);
    return NextResponse.json(
      { error: "Learning job failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
