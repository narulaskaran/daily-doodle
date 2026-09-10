import { NextRequest, NextResponse } from "next/server";
import {
  isGenerateDailyCronPaused,
  setGenerateDailyCronPaused,
} from "~/lib/cron-settings";

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

// GET - Current pause state for the daily generation cron
export async function GET(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const paused = await isGenerateDailyCronPaused();
    return NextResponse.json({ paused });
  } catch (error) {
    console.error("Admin cron GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron status" },
      { status: 500 },
    );
  }
}

// PATCH - Pause or unpause the daily generation cron
export async function PATCH(request: NextRequest) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { paused?: unknown };
    if (typeof body.paused !== "boolean") {
      return NextResponse.json(
        { error: "Missing required field: paused (boolean)" },
        { status: 400 },
      );
    }

    const paused = await setGenerateDailyCronPaused(body.paused);
    return NextResponse.json({ success: true, paused });
  } catch (error) {
    console.error("Admin cron PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update cron status" },
      { status: 500 },
    );
  }
}
