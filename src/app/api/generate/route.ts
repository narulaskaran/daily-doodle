import { NextRequest, NextResponse } from "next/server";
import { generateImageWithFlux } from "~/lib/replicate";
import { buildPromptFromComponents, buildFallbackPrompt } from "~/lib/prompt-templates";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Build a prompt by mixing and matching components from the ideas bank */
async function buildPromptFromIdeasBank(): Promise<string> {
  // Fetch all ideas (both used and unused) to build a component pool
  const allIdeas = await db.promptIdea.findMany({
    select: { animal: true, action: true, scene: true, props: true },
  });

  if (allIdeas.length === 0) {
    return buildFallbackPrompt();
  }

  // Mix and match: pick each component independently from different ideas
  return buildPromptFromComponents({
    animal: pickOne(allIdeas).animal,
    action: pickOne(allIdeas).action,
    scene: pickOne(allIdeas).scene,
    props: pickOne(allIdeas).props,
  });
}

interface GenerateRequest {
  prompt?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate using API key header
    const apiKey = request.headers.get("GENERATE_API_KEY");
    const expectedKey = process.env.GENERATE_API_KEY;

    if (!apiKey || apiKey !== expectedKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing API key" },
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body: GenerateRequest = await request.json();
    const prompt = body.prompt ?? (await buildPromptFromIdeasBank());

    // 3. Check Replicate API key
    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "Server configuration error: REPLICATE_API_TOKEN not set" },
        { status: 500 },
      );
    }

    console.log("Generating image with prompt:", prompt.substring(0, 50) + "...");

    // 4. Generate image using Flux Schnell via Replicate
    const imageBuffer = await generateImageWithFlux(prompt);

    // 5. Upload to UploadThing
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `coloring-page-${timestamp}-${Date.now()}.png`;

    const uploadedFile = await uploadImage(imageBuffer, filename);

    // 6. Save to Prisma database (pending approval)
    const titleMatch = prompt.match(/^(?:A |An )?(.+?)(?:,|$)/i);
    const title = titleMatch?.[1]
      ? titleMatch[1].charAt(0).toUpperCase() + titleMatch[1].slice(1)
      : `Coloring Page ${timestamp}`;
    const slug = `${timestamp}-${slugify(title)}-${Date.now()}`;

    const page = await db.coloringPage.create({
      data: {
        title,
        slug,
        description: prompt,
        prompt,
        imageUrl: uploadedFile.url,
        imageKey: uploadedFile.key,
        thumbnailUrl: uploadedFile.url,
        approved: null,
      },
    });

    console.log("Image uploaded and saved:", uploadedFile.name, "id:", page.id);

    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        prompt,
        imageUrl: uploadedFile.url,
        fileKey: uploadedFile.key,
        createdAt: page.createdAt.toISOString(),
      },
      cost: "$0.003 (estimated)",
    });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Daily Doodle Generation API",
    model: "Flux Schnell (Replicate)",
    cost: "~$0.003 per image",
    usage: "POST with GENERATE_API_KEY header and optional prompt in body",
  });
}
