import { NextRequest, NextResponse } from "next/server";
import {
  getStoredPages,
  updatePageApproval,
  deletePage,
  getPageById,
  type GeneratedPage,
} from "@/lib/db";
import { deleteFile } from "@/lib/uploadthing";

// GET - List all generated pages
export async function GET(request: NextRequest) {
  try {
    // Simple auth check using a shared secret
    const authHeader = request.headers.get("authorization");
    const expectedAuth = process.env.GENERATE_API_KEY;

    // Allow both Bearer token and API key in header
    const token = authHeader?.replace("Bearer ", "");
    if (token !== expectedAuth) {
      // For development, also check query param
      const { searchParams } = new URL(request.url);
      const apiKey = searchParams.get("api_key");
      if (apiKey !== expectedAuth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const pages = await getStoredPages();
    return NextResponse.json({ pages });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

// PATCH - Update page approval status
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedAuth = process.env.GENERATE_API_KEY;

    const token = authHeader?.replace("Bearer ", "");
    if (token !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, approved } = body;

    if (!id || approved === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: id, approved" },
        { status: 400 }
      );
    }

    await updatePageApproval(id, approved);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a page
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedAuth = process.env.GENERATE_API_KEY;

    const token = authHeader?.replace("Bearer ", "");
    if (token !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const page = await getPageById(id);
    if (page?.fileKey) {
      try {
        await deleteFile(page.fileKey);
      } catch (e) {
        console.error("Failed to delete file from UploadThing:", e);
      }
    }

    await deletePage(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
