import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "~/server/db";
import { getSignedFileUrl } from "~/lib/uploadthing";

const PREVIEW_WIDTH = 600;
const CACHE_MAX_AGE = 60 * 60; // 1 hour

function buildWatermarkSvg(width: number, height: number): Buffer {
  // Font-free diagonal stripe watermark (avoids fontconfig issues on Vercel)
  const stripeWidth = 6;
  const gap = 40;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" patternUnits="userSpaceOnUse"
          width="${gap}" height="${gap}"
          patternTransform="rotate(-30)">
          <rect width="${stripeWidth}" height="${gap}" fill="rgba(128,128,128,0.25)" />
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
      select: { imageKey: true, imageUrl: true },
    });

    if (!page?.imageUrl) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Fetch via signed URL if we have a file key, otherwise fall back to stored URL
    const fetchUrl = page.imageKey
      ? await getSignedFileUrl(page.imageKey, 60)
      : page.imageUrl;
    const imageResponse = await fetch(fetchUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Downscale the image to a buffer first so we know the actual dimensions
    const resizedBuffer = await sharp(imageBuffer)
      .resize(PREVIEW_WIDTH, undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();

    const metadata = await sharp(resizedBuffer).metadata();
    const finalWidth = metadata.width ?? PREVIEW_WIDTH;
    const finalHeight = metadata.height ?? PREVIEW_WIDTH;

    // Create watermark overlay matching the resized dimensions
    const watermarkSvg = buildWatermarkSvg(finalWidth, finalHeight);

    // Composite watermark on top
    const outputBuffer = await sharp(resizedBuffer)
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
