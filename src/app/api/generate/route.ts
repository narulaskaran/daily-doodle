import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  // Little Corner Style: Cozy, thick lines, minimal detail, high contrast
  const enhancedPrompt = `Little Corner style coloring page, ${prompt}, thick black outlines, white background, no shading, cozy aesthetic, simple shapes, high resolution, 300 DPI.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', // Using Gemini for prompt expansion or Flux via OpenRouter
        messages: [{ role: 'user', content: enhancedPrompt }],
      }),
    });

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
