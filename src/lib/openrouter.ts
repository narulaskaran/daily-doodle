/**
 * OpenRouter LLM utility for processing rejection feedback into guidelines.
 *
 * Uses a fast, cheap model to compare new feedback against existing guidelines
 * and decide whether to merge or create a new guideline.
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-001";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
}

async function chat(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_KEY not configured");
  }

  const res = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  return data.choices[0]?.message.content ?? "";
}

export type FeedbackType = "rejection" | "revision" | "approval";

export interface GuidelineMatch {
  /** "merge" if the feedback matches an existing guideline, "new" if it's novel */
  action: "merge" | "new";
  /** The ID of the existing guideline to merge with (only when action=merge) */
  matchId?: string;
  /** The refined guideline text (either merged or new) */
  guideline: string;
}

const FEEDBACK_CONTEXT: Record<FeedbackType, string> = {
  rejection: `When an admin rejects a generated image, they provide feedback about what was wrong.
Your job is to turn that feedback into a concise, actionable guideline for the image generation model to AVOID these issues in the future.`,
  revision: `When an admin requests revisions to a generated image, they describe what needs to change.
Your job is to turn that feedback into a concise, actionable guideline for the image generation model to AVOID these issues in future generations.`,
  approval: `When an admin approves a generated image, they optionally describe what made the image good.
Your job is to turn that positive feedback into a concise, actionable guideline for the image generation model to REPLICATE these qualities in future generations. Frame the guideline as a positive instruction (e.g., "Ensure lines are thick and bold" rather than "Don't make lines thin").`,
};

/**
 * Given feedback (from rejection, revision, or approval) and a list of
 * existing guidelines, determine whether this feedback should be merged
 * with an existing guideline or creates a new one.
 */
export async function processFeedback(
  feedback: string,
  existingGuidelines: { id: string; guideline: string; occurrences: number }[],
  feedbackType: FeedbackType = "rejection",
): Promise<GuidelineMatch> {
  const existingList =
    existingGuidelines.length > 0
      ? existingGuidelines
          .map((g) => `[ID: ${g.id}] (seen ${g.occurrences}x): ${g.guideline}`)
          .join("\n")
      : "(none)";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You help maintain a set of image generation guidelines for a kawaii coloring book app.
${FEEDBACK_CONTEXT[feedbackType]}

You will be given:
1. The admin's ${feedbackType} feedback
2. A list of existing guidelines (may be empty)

You must decide:
- If the feedback is about the SAME issue as an existing guideline, respond with MERGE and refine the existing guideline to incorporate the new feedback.
- If the feedback is about a NEW issue, respond with NEW and write a fresh guideline.

Respond in exactly this JSON format (no markdown, no extra text):
{"action": "merge", "matchId": "<id>", "guideline": "<refined guideline text>"}
or
{"action": "new", "guideline": "<new guideline text>"}

Guidelines should be:
- Written as instructions to an image generation model (e.g., "Never include text or lettering in the image")
- Concise (1-2 sentences max)
- Specific and actionable`,
    },
    {
      role: "user",
      content: `Admin ${feedbackType} feedback: "${feedback}"

Existing guidelines:
${existingList}`,
    },
  ];

  const response = await chat(messages);

  try {
    // Strip potential markdown fences
    const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as GuidelineMatch;
    if (!parsed.guideline || !parsed.action) {
      throw new Error("Missing required fields");
    }
    return parsed;
  } catch {
    // Fallback: treat as new guideline with the raw feedback
    return {
      action: "new",
      guideline: feedback,
    };
  }
}
