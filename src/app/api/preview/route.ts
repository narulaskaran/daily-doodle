import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "~/server/db";

const PREVIEW_WIDTH = 600;
const WATERMARK_TEXT = "Daily Doodle - Preview";
const CACHE_MAX_AGE = 60 * 60; // 1 hour

function buildWatermarkSvg(width: number, height: number): Buffer {
  // Create diagonal repeating watermark text
  const fontSize = Math.round(width / 15);
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" patternUnits="userSpaceOnUse"
          width="${width * 0.6}" height="${height * 0.4}"
          patternTransform="rotate(-30)">
          <text x="0" y="${fontSize}" font-family="Arial, sans-serif"
            font-size="${fontSize}" fill="rgba(128,128,128,0.35)"
            font-weight="bold">${WATERMARK_TEXT}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" />
    </svg>`;
  return Buffer.from(svg);
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const page = await db.coloringPage.findFirst({
      where: { id, approved: true },
      select: { imageUrl: true },
    });

    if (!page?.imageUrl) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Fetch the original image
    const imageResponse = await fetch(page.imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Downscale the image
    const resized = sharp(imageBuffer).resize(PREVIEW_WIDTH, undefined, {
      fit: "inside",
      withoutEnlargement: true,
    });

    const metadata = await resized.metadata();
    const finalWidth = metadata.width ?? PREVIEW_WIDTH;
    const finalHeight = metadata.height ?? PREVIEW_WIDTH;

    // Create watermark overlay
    const watermarkSvg = buildWatermarkSvg(finalWidth, finalHeight);

    // Composite watermark on top
    const outputBuffer = await resized
      .composite([{ input: watermarkSvg, top: 0, left: 0 }])
      .png({ quality: 80 })
      .toBuffer();

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}`,
      },
    });
  } catch (error) {
    console.error("Preview API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
