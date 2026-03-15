import { NextRequest, NextResponse } from "next/server";
import { generateImageWithFlux } from "~/lib/replicate";
import { buildPromptFromComponents, buildFallbackPrompt } from "~/lib/prompt-templates";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";
import { getGuidelinesPromptSuffix } from "~/lib/guidelines";

/** Pick one random item from an array */
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Build prompts by mixing and matching components from ideas bank, then fall back to hardcoded pool */
async function generateDefaultPrompts(count: number): Promise<string[]> {
  // Fetch all ideas to build a component pool for mix-and-match
  const allIdeas = await db.promptIdea.findMany({
    select: { id: true, animal: true, action: true, scene: true, props: true, used: true },
  });

  // Fetch learned guidelines to append to each prompt
  const guidelinesSuffix = await getGuidelinesPromptSuffix();

  const prompts: string[] = [];

  if (allIdeas.length > 0) {
    // Mix and match: pick each component independently from different ideas
    for (let i = 0; i < count; i++) {
      prompts.push(buildPromptFromComponents({
        animal: pickOne(allIdeas).animal,
        action: pickOne(allIdeas).action,
        scene: pickOne(allIdeas).scene,
        props: pickOne(allIdeas).props,
      }) + guidelinesSuffix);
    }

    // Mark all unused ideas as used since their components have been drawn from
    const unusedIds = allIdeas.filter((i) => !i.used).map((i) => i.id);
    if (unusedIds.length > 0) {
      await db.promptIdea.updateMany({
        where: { id: { in: unusedIds } },
        data: { used: true },
      });
    }
  } else {
    // No ideas in bank, fall back to hardcoded combos
    for (let i = 0; i < count; i++) {
      prompts.push(buildFallbackPrompt() + guidelinesSuffix);
    }
  }

  return prompts;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function handleGeneration(request: NextRequest) {
  try {
    const today = new Date().toISOString().split("T")[0]!;

    // Check how many pages we already generated today in the database
    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const endOfDay = new Date(`${today}T23:59:59.999Z`);

    const todayCount = await db.coloringPage.count({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (todayCount >= 4) {
      return NextResponse.json({
        message: "Already generated 4 sheets today",
        generated: 0,
        existingCount: todayCount,
      });
    }

    // Check Replicate API key
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 },
      );
    }

    // Get prompts (from request body if POST, or generate random defaults)
    const remaining = 4 - todayCount;
    let promptsToRun: string[];
    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body.prompts && Array.isArray(body.prompts)) {
          promptsToRun = (body.prompts as string[]).slice(0, remaining);
        } else {
          promptsToRun = await generateDefaultPrompts(remaining);
        }
      } catch {
        promptsToRun = await generateDefaultPrompts(remaining);
      }
    } else {
      promptsToRun = await generateDefaultPrompts(remaining);
    }

    const results: { success: boolean; id?: string; filename?: string; url?: string; error?: string }[] = [];

    for (let i = 0; i < promptsToRun.length; i++) {
      const prompt = promptsToRun[i]!;
      const seqNum = todayCount + i + 1;
      console.log(`Generating image ${seqNum}/4:`, prompt.substring(0, 50) + "...");

      try {
        const imageBuffer = await generateImageWithFlux(prompt);
        const filename = `${today}_0${seqNum}.png`;

        const uploaded = await uploadImage(imageBuffer, filename);

        // Extract a short title from the prompt
        const titleMatch = prompt.match(/^(?:A |An )?(.+?)(?:,|$)/i);
        const title = titleMatch?.[1]
          ? titleMatch[1].charAt(0).toUpperCase() + titleMatch[1].slice(1)
          : `Coloring Page ${today} #${seqNum}`;

        const slug = `${today}-${slugify(title)}-${seqNum}`;

        // Save to Prisma database with approved=null (pending review)
        const page = await db.coloringPage.create({
          data: {
            title,
            slug,
            description: prompt,
            prompt,
            imageUrl: uploaded.url,
            imageKey: uploaded.key,
            thumbnailUrl: uploaded.url,
            approved: null,
          },
        });

        results.push({ success: true, id: page.id, filename: uploaded.name, url: uploaded.url });
        console.log(`Uploaded and saved: ${filename} (id: ${page.id})`);
      } catch (err) {
        console.error(`Generation ${seqNum} failed:`, err);
        results.push({ success: false, error: err instanceof Error ? err.message : "Unknown" });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      date: today,
      generated: successCount,
      results,
      cost: `~$${(successCount * 0.003).toFixed(3)}`,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json(
      { error: "Generation failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Vercel cron jobs invoke routes via GET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleGeneration(request);
}

export async function POST(request: NextRequest) {
  // Manual invocation via POST (also supports custom prompts in body)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleGeneration(request);
}
