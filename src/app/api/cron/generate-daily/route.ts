import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { acquireReplicateRateLimit } from "~/lib/replicate-ratelimit";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";

// Replicate image generation - Flux Schnell
const MODEL_ID = "black-forest-labs/flux-schnell";

const replicate = new Replicate();

// Composable prompt pieces for daily variety (kawaii style)
const PROMPT_TEMPLATE =
  "Black and white line art coloring page, pure white background. A kawaii, chubby [ANIMAL] [ACTION] in a cozy [SCENE]. Thick, bold, uniform black outlines for the main shapes, clean simple lines for inner details. Surrounded by cute, simple props like [PROPS]. Flat 2D vector style, strictly no shading, no grayscale, no cross-hatching. Heartwarming, relaxing children's coloring book illustration.";

interface PromptCombo {
  animal: string;
  action: string;
  scene: string;
  props: string;
}

const PROMPT_COMBOS: PromptCombo[] = [
  { animal: "bear", action: "relaxing on a towel", scene: "sunny beach", props: "a sandcastle, a beach umbrella, and a cooler" },
  { animal: "cat", action: "baking cookies", scene: "kitchen", props: "a mixing bowl, oven mitts, and a cookie jar" },
  { animal: "frog", action: "watering plants", scene: "greenhouse", props: "potted plants, a watering can, and little ladybugs" },
  { animal: "dinosaur", action: "picking flowers", scene: "garden", props: "a watering can, potted plants, and butterflies" },
  { animal: "bunny", action: "reading a book", scene: "library nook", props: "stacked books, a reading lamp, and a warm blanket" },
  { animal: "penguin", action: "sipping hot cocoa", scene: "snowy cabin", props: "a steaming mug, marshmallows, and a cozy fireplace" },
  { animal: "fox", action: "painting on a canvas", scene: "art studio", props: "paint brushes, a palette, and jars of paint" },
  { animal: "owl", action: "stargazing through a telescope", scene: "rooftop at night", props: "a telescope, twinkling stars, and a crescent moon" },
  { animal: "raccoon", action: "selling lemonade", scene: "sunny neighborhood", props: "a lemonade stand, cups, and a pitcher of lemonade" },
  { animal: "hedgehog", action: "picking apples", scene: "orchard", props: "apple trees, a basket, and fallen leaves" },
  { animal: "duck", action: "splashing in puddles", scene: "rainy park", props: "rain boots, an umbrella, and raindrops" },
  { animal: "mouse", action: "decorating a cake", scene: "bakery", props: "frosting bags, sprinkles, and a tiered cake" },
  { animal: "elephant", action: "planting seeds", scene: "vegetable garden", props: "seed packets, a trowel, and tiny sprouts" },
  { animal: "panda", action: "doing yoga", scene: "bamboo garden", props: "a yoga mat, bamboo stalks, and cherry blossoms" },
  { animal: "otter", action: "floating on its back", scene: "gentle river", props: "lily pads, a little fish, and reeds" },
  { animal: "turtle", action: "having a picnic", scene: "sunny meadow", props: "a checkered blanket, a basket, and sandwiches" },
  { animal: "squirrel", action: "roasting marshmallows", scene: "campfire scene", props: "a campfire, marshmallow sticks, and a tent" },
  { animal: "sheep", action: "knitting a scarf", scene: "cozy living room", props: "yarn balls, knitting needles, and a rocking chair" },
  { animal: "pig", action: "splashing in a mud bath", scene: "farm", props: "a wooden fence, sunflowers, and a barn" },
  { animal: "koala", action: "napping in a tree", scene: "eucalyptus forest", props: "eucalyptus leaves, butterflies, and fluffy clouds" },
  { animal: "dog", action: "catching frisbees", scene: "sunny park", props: "a frisbee, a park bench, and daisies" },
  { animal: "giraffe", action: "reaching for fruit", scene: "savanna", props: "tall trees, birds, and fluffy clouds" },
  { animal: "hamster", action: "running on a wheel", scene: "cozy hamster home", props: "a hamster wheel, wood shavings, and sunflower seeds" },
  { animal: "deer", action: "drinking from a stream", scene: "enchanted forest", props: "mushrooms, ferns, and fireflies" },
  { animal: "sloth", action: "hanging from a branch", scene: "tropical rainforest", props: "vines, tropical flowers, and a toucan" },
  { animal: "seal", action: "balancing a ball on its nose", scene: "seaside dock", props: "a beach ball, seagulls, and waves" },
  { animal: "rabbit", action: "tending a carrot patch", scene: "country garden", props: "carrots, a garden gate, and bumblebees" },
  { animal: "lion cub", action: "chasing butterflies", scene: "grassy savanna", props: "tall grass, butterflies, and wildflowers" },
  { animal: "hippo", action: "taking a bubble bath", scene: "bathroom", props: "rubber ducks, bubbles, and a shower cap" },
  { animal: "red panda", action: "eating bamboo shoots", scene: "misty mountain", props: "bamboo, cherry blossoms, and stepping stones" },
];

function buildPrompt(combo: PromptCombo): string {
  return PROMPT_TEMPLATE
    .replace("[ANIMAL]", combo.animal)
    .replace("[ACTION]", combo.action)
    .replace("[SCENE]", combo.scene)
    .replace("[PROPS]", combo.props);
}

/** Pick `count` random unique items from an array using Fisher-Yates shuffle */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}

/** Build prompts by mixing and matching components from ideas bank, then fall back to hardcoded pool */
async function generateDefaultPrompts(count: number): Promise<string[]> {
  // Fetch all ideas to build a component pool for mix-and-match
  const allIdeas = await db.promptIdea.findMany({
    select: { id: true, animal: true, action: true, scene: true, props: true, used: true },
  });

  const prompts: string[] = [];

  if (allIdeas.length > 0) {
    // Mix and match: pick each component independently from different ideas
    for (let i = 0; i < count; i++) {
      const animal = pickRandom(allIdeas, 1)[0]!.animal;
      const action = pickRandom(allIdeas, 1)[0]!.action;
      const scene = pickRandom(allIdeas, 1)[0]!.scene;
      const props = pickRandom(allIdeas, 1)[0]!.props;

      prompts.push(buildPrompt({ animal, action, scene, props }));
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
    const fallbackPrompts = pickRandom(PROMPT_COMBOS, count).map(buildPrompt);
    prompts.push(...fallbackPrompts);
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

async function generateWithFlux(prompt: string): Promise<Buffer> {
  const output = await replicate.run(MODEL_ID, {
    input: {
      prompt,
      num_outputs: 1,
      output_format: "png",
    },
  });

  // Flux Schnell returns an array of FileOutput objects (ReadableStream with .blob() method)
  const images = output as unknown[];
  const firstImage = images[0];
  if (!firstImage) {
    throw new Error("No image output from Replicate");
  }

  // FileOutput extends ReadableStream and has a .blob() method.
  // Convert to a Blob first, then to an ArrayBuffer.
  let blob: Blob;
  if (firstImage instanceof Blob) {
    blob = firstImage;
  } else if (typeof (firstImage as { blob?: unknown }).blob === "function") {
    blob = await (firstImage as { blob(): Promise<Blob> }).blob();
  } else if (typeof firstImage === "string") {
    // Fallback: URL string — fetch the image
    const resp = await fetch(firstImage);
    blob = await resp.blob();
  } else {
    throw new Error(`Unexpected Replicate output type: ${typeof firstImage}`);
  }

  return Buffer.from(await blob.arrayBuffer());
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
        await acquireReplicateRateLimit();
        const imageBuffer = await generateWithFlux(prompt);
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
