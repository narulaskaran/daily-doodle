import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { deleteFile } from "~/lib/uploadthing";

function authenticate(request: NextRequest): boolean {
  const expectedAuth = process.env.GENERATE_API_KEY;
  if (!expectedAuth) return false;

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token === expectedAuth) return true;

  // Check query param (for GET convenience)
  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("api_key");
  if (apiKey === expectedAuth) return true;

  return false;
}

// GET - List all generated pages
export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pages = await db.coloringPage.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Map to the shape the admin UI expects
    const mapped = pages.map((p) => ({
      id: p.id,
      prompt: p.prompt ?? p.description ?? "",
      imageUrl: p.imageUrl ?? p.thumbnailUrl ?? "",
      fileKey: p.imageKey ?? p.pdfKey,
      createdAt: p.createdAt.toISOString(),
      approved: p.approved,
      rejected: p.approved === false,
      pdfUrl: p.pdfUrl || undefined,
    }));

    return NextResponse.json({ pages: mapped });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}

// PATCH - Update page approval status
export async function PATCH(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, approved } = body;

    if (!id || approved === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: id, approved" },
        { status: 400 },
      );
    }

    await db.coloringPage.update({
      where: { id },
      data: { approved: Boolean(approved) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin PATCH error:", error);
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

// DELETE - Remove a page
export async function DELETE(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    const page = await db.coloringPage.findUnique({ where: { id } });

    // Delete files from UploadThing
    if (page?.imageKey) {
      try {
        await deleteFile(page.imageKey);
      } catch (e) {
        console.error("Failed to delete image from UploadThing:", e);
      }
    }
    if (page?.pdfKey) {
      try {
        await deleteFile(page.pdfKey);
      } catch (e) {
        console.error("Failed to delete PDF from UploadThing:", e);
      }
    }

    await db.coloringPage.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
