import { NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET() {
  try {
    const pages = await db.coloringPage.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      pages.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        previewUrl: `/api/preview?id=${p.id}`,
        pdfUrl: p.pdfUrl || null,
        createdAt: p.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    console.error("Error fetching coloring pages:", error);
    return NextResponse.json([]);
  }
}
