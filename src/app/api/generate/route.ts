import { NextRequest, NextResponse } from "next/server";
import { uploadImage, type UploadedFile } from "@/lib/uploadthing";

// OpenRouter image generation - Flux Schnell (~$0.003/image)
const MODEL_ID = "black-forest-labs/flux-schnell";

interface GenerateRequest {
  prompt?: string;
}

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

  // Download the generated image
  const imageResponse = await fetch(data.data[0].url);
  return Buffer.from(await imageResponse.arrayBuffer());
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate using API key header
    const apiKey = request.headers.get("GENERATE_API_KEY");
    const expectedKey = process.env.GENERATE_API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing API key" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: GenerateRequest = await request.json();
    const prompt =
      body.prompt ||
      "A simple, black and white line drawing of a friendly animal, suitable for a children's coloring book, single subject, white background, clean lines";

    // 3. Check OpenRouter API key
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: OPENROUTER_API_KEY not set" },
        { status: 500 }
      );
    }

    console.log("Generating image with prompt:", prompt.substring(0, 50) + "...");

    // 4. Generate image using Flux Schnell via OpenRouter
    const imageBuffer = await generateWithFlux(prompt);

    // 5. Upload to UploadThing
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `coloring-page-${timestamp}-${Date.now()}.png`;

    let uploadedFile: UploadedFile;
    try {
      uploadedFile = await uploadImage(imageBuffer, filename);
    } catch (uploadError) {
      console.error("UploadThing error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image", details: uploadError instanceof Error ? uploadError.message : "Unknown" },
        { status: 500 }
      );
    }

    console.log("Image uploaded:", uploadedFile.name);

    return NextResponse.json({
      success: true,
      page: {
        id: `page-${Date.now()}`,
        prompt,
        imageUrl: uploadedFile.url,
        fileKey: uploadedFile.key,
        createdAt: new Date().toISOString(),
      },
      cost: "$0.003 (estimated)",
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      {
        "error": "Internal server error",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Daily Doodle Generation API",
    model: "Flux Schnell (OpenRouter)",
    cost: "~$0.003 per image",
    usage: "POST with GENERATE_API_KEY header and optional prompt in body",
  });
}
