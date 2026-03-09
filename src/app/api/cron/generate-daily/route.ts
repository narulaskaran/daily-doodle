import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { acquireReplicateRateLimit } from "~/lib/replicate-ratelimit";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";

// Replicate image generation - Flux Schnell
const MODEL_ID = "black-forest-labs/flux-schnell";

const replicate = new Replicate();

// Prompts for variety in daily coloring sheets
const DEFAULT_PROMPTS = [
  "A friendly dinosaur in a grassy field, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A cute cat sitting on a windowsill, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A happy teddy bear holding a balloon, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A smiling sun with clouds and flowers, simple line drawing for children's coloring book, single subject, white background, clean black lines",
];

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

  // Flux Schnell returns an array of FileOutput objects (implement Blob)
  const images = output as Blob[];
  const firstImage = images[0];
  if (!firstImage) {
    throw new Error("No image output from Replicate");
  }

  return Buffer.from(await firstImage.arrayBuffer());
}

export async function POST(request: NextRequest) {
  // Verify cron secret for security (Vercel sends this automatically for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    // Get prompts (from request or use defaults)
    let prompts = DEFAULT_PROMPTS;
    try {
      const body = await request.json();
      if (body.prompts && Array.isArray(body.prompts)) {
        prompts = body.prompts;
      }
    } catch {
      // No body, use defaults
    }

    const remaining = 4 - todayCount;
    const promptsToRun = prompts.slice(0, remaining);

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

export async function GET() {
  return NextResponse.json({
    message: "Daily Doodle Cron - POST to trigger generation",
    schedule: "0 4 * * * (4 AM UTC daily)",
    generates: "4 coloring sheets per run",
    model: "Flux Schnell via Replicate",
    auth: "Bearer CRON_SECRET if configured",
  });
}
