import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: "Prompt is required" },
      { status: 400 }
    );
  }

  // Little Corner Style: Cozy, thick lines, minimal detail, high contrast
  const enhancedPrompt = `Little Corner style coloring page, ${prompt}, thick black outlines, white background, no shading, cozy aesthetic, simple shapes, high resolution, 300 DPI, line art, black and white illustration`;

  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENROUTER_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://daily-doodle.vercel.app',
        'X-Title': 'Daily Doodle',
      },
      body: JSON.stringify({
        model: 'black-forest-labs/flux-1-pro',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // OpenRouter returns image URL in data.data[0].url
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: "No image URL returned from OpenRouter" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl,
    });
  } catch (error) {
    console.error("OpenRouter error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
