import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { getSignedFileUrl } from "~/lib/uploadthing";

const SIGNED_URL_TTL = 60; // 1 minute — just long enough for the redirect to complete

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const type = request.nextUrl.searchParams.get("type") ?? "pdf"; // "pdf" or "image"

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try {
    const page = await db.coloringPage.findFirst({
      where: { id, approved: true },
      select: { pdfKey: true, imageKey: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const fileKey = type === "image" ? page.imageKey : page.pdfKey;

    if (!fileKey) {
      return NextResponse.json(
        { error: `No ${type} available for this page` },
        { status: 404 },
      );
    }

    const signedUrl = await getSignedFileUrl(fileKey, SIGNED_URL_TTL);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Download API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
