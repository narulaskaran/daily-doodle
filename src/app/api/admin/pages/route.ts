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
      include: { revisions: { orderBy: { attempt: "asc" } } },
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
      revisions: p.revisions.map((r) => ({
        id: r.id,
        attempt: r.attempt,
        imageUrl: r.imageUrl,
        reviewComment: r.reviewComment,
        chosen: r.chosen,
        createdAt: r.createdAt.toISOString(),
      })),
    }));

    return NextResponse.json({ pages: mapped });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}

// PATCH - Update page approval status or choose a revision
export async function PATCH(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, approved, chooseRevisionId } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    // Choose a revision: replace the original page's image with the revision's image
    if (chooseRevisionId) {
      const revision = await db.reviewRevision.findUnique({ where: { id: chooseRevisionId } });
      if (!revision || revision.coloringPageId !== id) {
        return NextResponse.json({ error: "Revision not found or doesn't belong to this page" }, { status: 404 });
      }

      // Update the page image and mark this revision as chosen
      await db.$transaction([
        db.coloringPage.update({
          where: { id },
          data: {
            imageUrl: revision.imageUrl,
            imageKey: revision.imageKey,
            thumbnailUrl: revision.imageUrl,
          },
        }),
        db.reviewRevision.updateMany({
          where: { coloringPageId: id },
          data: { chosen: false },
        }),
        db.reviewRevision.update({
          where: { id: chooseRevisionId },
          data: { chosen: true },
        }),
      ]);

      return NextResponse.json({ success: true, action: "revision_chosen" });
    }

    // Standard approval update
    if (approved === undefined) {
      return NextResponse.json(
        { error: "Missing required field: approved or chooseRevisionId" },
        { status: 400 },
      );
    }

    await db.coloringPage.update({
      where: { id },
      data: { approved: Boolean(approved) },
    });

    // If rejecting with feedback, process it into a guideline
    if (!approved && body.rejectionFeedback?.trim()) {
      try {
        const { processRejectionFeedback } = await import("~/lib/openrouter");
        const existing = await db.imageGuideline.findMany({
          select: { id: true, guideline: true, occurrences: true },
        });
        const result = await processRejectionFeedback(
          body.rejectionFeedback as string,
          existing,
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
        // Log but don't fail the rejection itself
        console.error("Failed to process rejection feedback:", err);
      }
    }

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
