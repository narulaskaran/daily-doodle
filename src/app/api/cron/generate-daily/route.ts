import { NextRequest, NextResponse } from "next/server";
import { uploadImage, listFiles } from "@/lib/uploadthing";

// OpenRouter image generation - Flux Schnell
const MODEL_ID = "black-forest-labs/flux-schnell";

// Prompts for variety in daily coloring sheets
const DEFAULT_PROMPTS = [
  "A friendly dinosaur in a grassy field, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A cute cat sitting on a windowsill, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A happy teddy bear holding a balloon, simple line drawing for children's coloring book, single subject, white background, clean black lines",
  "A smiling sun with clouds and flowers, simple line drawing for children's coloring book, single subject, white background, clean black lines",
];

async function generateWithFlux(prompt: string): Promise<Buffer> {
  const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.VERCEL_URL || "https://daily-doodle.vercel.app",
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
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if we already generated today
    const today = new Date().toISOString().split("T")[0];
    
    if (process.env.UPLOADTHING_TOKEN) {
      const existingFiles = await listFiles();
      const todayFiles = existingFiles.filter(f => 
        f.name.includes(today) && f.name.endsWith(".png")
      );

      if (todayFiles.length >= 4) {
        return NextResponse.json({
          message: "Already generated 4 sheets today",
          generated: 0,
          existingCount: todayFiles.length,
        });
      }
    }

    // Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
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

    const results: any[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`Generating image ${i + 1}/4:`, prompt.substring(0, 50) + "...");

      try {
        const imageBuffer = await generateWithFlux(prompt);
        const filename = `${today}_0${i + 1}.png`;

        const uploaded = await uploadImage(imageBuffer, filename);
        results.push({ success: true, filename: uploaded.name, url: uploaded.url });
        console.log(`Uploaded: ${filename}`);
      } catch (err) {
        console.error(`Generation ${i + 1} failed:`, err);
        results.push({ success: false, error: err instanceof Error ? err.message : "Unknown" });
      }

      // Rate limit between generations (be nice to the API)
      if (i < prompts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;

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
      { status: 500 }
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
