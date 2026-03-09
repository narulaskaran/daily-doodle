import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

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

// GET - List all prompt ideas
export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ideas = await db.promptIdea.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ideas });
  } catch (error) {
    console.error("PromptIdeas GET error:", error);
    return NextResponse.json({ error: "Failed to fetch ideas" }, { status: 500 });
  }
}

// POST - Add a new prompt idea
export async function POST(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { animal, action, scene, props } = body;

    if (!animal?.trim() || !action?.trim() || !scene?.trim() || !props?.trim()) {
      return NextResponse.json(
        { error: "All fields required: animal, action, scene, props" },
        { status: 400 },
      );
    }

    const idea = await db.promptIdea.create({
      data: {
        animal: animal.trim(),
        action: action.trim(),
        scene: scene.trim(),
        props: props.trim(),
      },
    });

    return NextResponse.json({ success: true, idea });
  } catch (error) {
    console.error("PromptIdeas POST error:", error);
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}

// DELETE - Remove a prompt idea
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

    await db.promptIdea.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PromptIdeas DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
