import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { processRejectionFeedback } from "~/lib/openrouter";

function authenticate(request: NextRequest): boolean {
  const expectedAuth = process.env.GENERATE_API_KEY;
  if (!expectedAuth) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token === expectedAuth) return true;

  const { searchParams } = new URL(request.url);
  const apiKey = searchParams.get("api_key");
  if (apiKey === expectedAuth) return true;

  return false;
}

// GET - List all guidelines
export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guidelines = await db.imageGuideline.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ guidelines });
}

// POST - Process rejection feedback into a guideline
export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { feedback, pageId } = body as { feedback?: string; pageId?: string };

  if (!feedback?.trim()) {
    return NextResponse.json(
      { error: "Missing required field: feedback" },
      { status: 400 },
    );
  }

  // Reject the page if pageId is provided
  if (pageId) {
    await db.coloringPage.update({
      where: { id: pageId },
      data: { approved: false },
    });
  }

  // Fetch existing guidelines for dedup comparison
  const existing = await db.imageGuideline.findMany({
    select: { id: true, guideline: true, occurrences: true },
  });

  // Use LLM to decide merge vs new
  const result = await processRejectionFeedback(feedback, existing);

  let guideline;
  if (result.action === "merge" && result.matchId) {
    // Merge: update existing guideline text and bump occurrences
    guideline = await db.imageGuideline.update({
      where: { id: result.matchId },
      data: {
        guideline: result.guideline,
        occurrences: { increment: 1 },
      },
    });
  } else {
    // New: create a fresh guideline
    guideline = await db.imageGuideline.create({
      data: { guideline: result.guideline },
    });
  }

  return NextResponse.json({
    success: true,
    action: result.action,
    guideline,
  });
}

// DELETE - Remove a guideline
export async function DELETE(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing required param: id" },
      { status: 400 },
    );
  }

  await db.imageGuideline.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
