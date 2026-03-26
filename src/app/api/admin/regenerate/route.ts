import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { acquireReplicateRateLimit } from "~/lib/replicate-ratelimit";
import { uploadImage } from "~/lib/uploadthing";
import { db } from "~/server/db";

// Use flux-kontext-pro for image-guided regeneration (supports both image + text prompt)
const IMG2IMG_MODEL = "black-forest-labs/flux-kontext-pro";
const ATTEMPTS = 3;

const replicate = new Replicate();

function authenticate(request: NextRequest): boolean {
  const expectedAuth = process.env.GENERATE_API_KEY;
  if (!expectedAuth) return false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  return token === expectedAuth;
}

async function generateImg2Img(
  imageUrl: string,
  prompt: string,
): Promise<Buffer> {
  const output = await replicate.run(IMG2IMG_MODEL, {
    input: {
      input_image: imageUrl,
      prompt,
      output_format: "png",
      aspect_ratio: "match_input_image",
    },
  });

  // flux-kontext-pro returns a single FileOutput (ReadableStream with url())
  const result = Array.isArray(output) ? output[0] : output;
  if (!result) {
    throw new Error("No image output from Replicate img2img");
  }

  // Result may be a FileOutput with url(), a URL string, or a Blob
  if (typeof result === "object" && "url" in result && typeof (result as { url: () => string }).url === "function") {
    const imageResultUrl = (result as { url: () => string }).url();
    const response = await fetch(imageResultUrl);
    if (!response.ok) throw new Error(`Failed to fetch generated image: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }

  if (typeof result === "string") {
    const response = await fetch(result);
    if (!response.ok) throw new Error(`Failed to fetch generated image: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  }

  // Blob-like
  const blob = result as Blob;
  return Buffer.from(await blob.arrayBuffer());
}

interface RegenerateRequest {
  pageId: string;
  reviewComment: string;
}

export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: RegenerateRequest = await request.json();
    const { pageId, reviewComment } = body;

    if (!pageId || !reviewComment?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: pageId, reviewComment" },
        { status: 400 },
      );
    }

    // Fetch the original page
    const page = await db.coloringPage.findUnique({ where: { id: pageId } });
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    if (!page.imageUrl) {
      return NextResponse.json({ error: "Page has no image to use as reference" }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: "REPLICATE_API_TOKEN not configured" },
        { status: 500 },
      );
    }

    // Build a revised prompt incorporating the review feedback
    const basePrompt = page.prompt ?? "Black and white line art coloring page, pure white background. Kawaii, chubby animal in a cozy scene. Thick, bold, uniform black outlines. Flat 2D vector style, strictly no shading, no grayscale, no cross-hatching. Heartwarming, relaxing children's coloring book illustration.";
    const revisedPrompt = `${basePrompt} Revision notes: ${reviewComment.trim()}`;

    const results: { attempt: number; success: boolean; id?: string; imageUrl?: string; error?: string }[] = [];

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      // Wait between attempts to avoid hitting Replicate rate limits
      if (attempt > 1) {
        const delayMs = 12_000; // 12s gap respects 6 req/min limit
        console.log(`Waiting ${delayMs / 1000}s before attempt ${attempt}...`);
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
      console.log(`Regenerating page ${pageId} attempt ${attempt}/${ATTEMPTS}`);

      try {
        await acquireReplicateRateLimit();
        const imageBuffer = await generateImg2Img(page.imageUrl, revisedPrompt);

        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `revision-${pageId}-${attempt}-${Date.now()}.png`;

        const uploaded = await uploadImage(imageBuffer, filename);

        const revision = await db.reviewRevision.create({
          data: {
            coloringPageId: pageId,
            reviewComment: reviewComment.trim(),
            attempt,
            imageUrl: uploaded.url,
            imageKey: uploaded.key,
          },
        });

        results.push({
          attempt,
          success: true,
          id: revision.id,
          imageUrl: uploaded.url,
        });

        console.log(`Revision ${attempt} uploaded: ${uploaded.name}`);
      } catch (err) {
        console.error(`Revision attempt ${attempt} failed:`, err);
        results.push({
          attempt,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    // Process revision feedback into a guideline (non-blocking)
    try {
      const { processFeedback } = await import("~/lib/openrouter");
      const existing = await db.imageGuideline.findMany({
        select: { id: true, guideline: true, occurrences: true },
      });
      const result = await processFeedback(
        reviewComment.trim(),
        existing,
        "revision",
      );
      if (result.action === "merge" && result.matchId) {
        await db.imageGuideline.update({
          where: { id: result.matchId },
          data: {
            guideline: result.guideline,
            occurrences: { increment: 1 },
          },
        });
      } else {
        await db.imageGuideline.create({
          data: { guideline: result.guideline },
        });
      }
    } catch (err) {
      console.error("Failed to process revision feedback into guideline:", err);
    }

    return NextResponse.json({
      pageId,
      reviewComment: reviewComment.trim(),
      generated: successCount,
      results,
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { error: "Regeneration failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
