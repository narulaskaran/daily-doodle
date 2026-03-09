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
        filename: p.slug,
        path: p.imageUrl ?? p.pdfUrl,
        createdAt: p.createdAt.toISOString(),
        url: p.imageUrl ?? p.pdfUrl,
        key: p.imageKey ?? p.pdfKey,
      })),
    );
  } catch (error) {
    console.error("Error fetching coloring pages:", error);
    return NextResponse.json([]);
  }
}
