import { NextRequest, NextResponse } from "next/server";
import { uploadImage, listFiles } from "~/lib/uploadthing";
import { db } from "~/server/db";

// OpenRouter image generation - Flux Schnell
const MODEL_ID = "black-forest-labs/flux-schnell";

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
  const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://daily-doodle-pi.vercel.app",
      "X-Title": "Daily Doodle",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      prompt,
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.data || !data.data[0]?.url) {
    throw new Error("No image URL in response");
  }

  const imageResponse = await fetch(data.data[0].url);
  return Buffer.from(await imageResponse.arrayBuffer());
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

    // Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
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

      // Rate limit between generations
      if (i < promptsToRun.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
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
    model: "Flux Schnell via OpenRouter",
    auth: "Bearer CRON_SECRET if configured",
  });
}
