import { NextRequest, NextResponse } from "next/server";
import { generateImageWithFlux } from "~/lib/replicate";
import { buildPromptFromComponents, buildFallbackPrompt } from "~/lib/prompt-templates";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";
import { getGuidelinesPrefix } from "~/lib/guidelines";

interface PromptComponents {
  animal: string;
  action: string;
  scene: string;
  props: string;
}

/** Pick one random item from an array */
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Weighted random pick. Each item's probability is proportional to its weight.
 * Falls back to uniform random if all weights are zero.
 */
function weightedPick<T>(items: T[], getWeight: (item: T) => number): T {
  const weights = items.map(getWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return pickOne(items);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/**
 * Build prompts by mixing components from the ideas bank, using diversity-aware
 * weighted selection to avoid repeating recently-used animals and scenes.
 */
async function generateDefaultPrompts(
  count: number,
): Promise<{ prompt: string; components: PromptComponents }[]> {
  const allIdeas = await db.promptIdea.findMany({
    select: { id: true, animal: true, action: true, scene: true, props: true, used: true },
  });

  // Fetch recent prompt components (last 14 days) to build a frequency map
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentPages = await db.coloringPage.findMany({
    where: { createdAt: { gte: fourteenDaysAgo } },
    select: { promptComponents: true },
    orderBy: { createdAt: "desc" },
  });

  const recentAnimals = new Map<string, number>();
  const recentScenes = new Map<string, number>();
  const recentActions = new Map<string, number>();
  for (const page of recentPages) {
    const comp = page.promptComponents as { animal?: string; scene?: string; action?: string } | null;
    if (!comp) continue;
    if (comp.animal) recentAnimals.set(comp.animal, (recentAnimals.get(comp.animal) ?? 0) + 1);
    if (comp.scene) recentScenes.set(comp.scene, (recentScenes.get(comp.scene) ?? 0) + 1);
    if (comp.action) recentActions.set(comp.action, (recentActions.get(comp.action) ?? 0) + 1);
  }

  const guidelinesPrefix = await getGuidelinesPrefix();
  const results: { prompt: string; components: PromptComponents }[] = [];

  if (allIdeas.length > 0) {
    // Track which animals we've already used within this batch to avoid intra-batch repeats
    const usedAnimalsThisRun = new Set<string>();

    for (let i = 0; i < count; i++) {
      // Weight inversely by recent usage frequency; block same animal twice in one batch
      const animalIdea = weightedPick(allIdeas, (idea) => {
        if (usedAnimalsThisRun.has(idea.animal)) return 0;
        return 1 / ((recentAnimals.get(idea.animal) ?? 0) + 1);
      });
      usedAnimalsThisRun.add(animalIdea.animal);

      const actionIdea = weightedPick(
        allIdeas,
        (idea) => 1 / ((recentActions.get(idea.action) ?? 0) + 1),
      );
      const sceneIdea = weightedPick(
        allIdeas,
        (idea) => 1 / ((recentScenes.get(idea.scene) ?? 0) + 1),
      );
      const propsIdea = pickOne(allIdeas);

      const components: PromptComponents = {
        animal: animalIdea.animal,
        action: actionIdea.action,
        scene: sceneIdea.scene,
        props: propsIdea.props,
      };

      const prompt = guidelinesPrefix + buildPromptFromComponents(components);
      results.push({ prompt, components });
    }

    // Mark all previously-unused ideas as used now that we've drawn from the pool
    const unusedIds = allIdeas.filter((i) => !i.used).map((i) => i.id);
    if (unusedIds.length > 0) {
      await db.promptIdea.updateMany({
        where: { id: { in: unusedIds } },
        data: { used: true },
      });
    }
  } else {
    // No ideas in bank — fall back to hardcoded combos
    for (let i = 0; i < count; i++) {
      const prompt = guidelinesPrefix + buildFallbackPrompt();
      results.push({ prompt, components: { animal: "", action: "", scene: "", props: "" } });
    }
  }

  return results;
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

    const startOfDay = new Date(`${today}T00:00:00.000Z`);
    const endOfDay = new Date(`${today}T23:59:59.999Z`);

    const todayCount = await db.coloringPage.count({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
    });

    if (todayCount >= 4) {
      return NextResponse.json({
        message: "Already generated 4 sheets today",
        generated: 0,
        existingCount: todayCount,
      });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 },
      );
    }

    const remaining = 4 - todayCount;
    let promptsToRun: { prompt: string; components: PromptComponents | null }[];

    if (request.method === "POST") {
      try {
        const body = await request.json();
        if (body.prompts && Array.isArray(body.prompts)) {
          // Custom prompts from the request body — no component data available
          promptsToRun = (body.prompts as string[])
            .slice(0, remaining)
            .map((p) => ({ prompt: p, components: null }));
        } else {
          promptsToRun = await generateDefaultPrompts(remaining);
        }
      } catch {
        promptsToRun = await generateDefaultPrompts(remaining);
      }
    } else {
      promptsToRun = await generateDefaultPrompts(remaining);
    }

    const results: {
      success: boolean;
      id?: string;
      filename?: string;
      url?: string;
      error?: string;
    }[] = [];

    for (let i = 0; i < promptsToRun.length; i++) {
      const { prompt, components } = promptsToRun[i]!;
      const seqNum = todayCount + i + 1;
      console.log(`Generating image ${seqNum}/4:`, prompt.substring(0, 80) + "...");

      try {
        const imageBuffer = await generateImageWithFlux(prompt);
        const filename = `${today}_0${seqNum}.png`;
        const uploaded = await uploadImage(imageBuffer, filename);

        const titleMatch = prompt.match(/^(?:A |An )?(.+?)(?:,|$)/i);
        const title = titleMatch?.[1]
          ? titleMatch[1].charAt(0).toUpperCase() + titleMatch[1].slice(1)
          : `Coloring Page ${today} #${seqNum}`;

        const slug = `${today}-${slugify(title)}-${seqNum}`;

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            promptComponents: (components ?? undefined) as any,
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
      {
        error: "Generation failed",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleGeneration(request);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handleGeneration(request);
}
