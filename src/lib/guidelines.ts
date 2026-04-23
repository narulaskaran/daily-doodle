import { db } from "~/server/db";

/**
 * Fetch all image guidelines and format them as a prompt prefix.
 *
 * Placing guidelines at the START of the prompt gives them higher priority
 * in the model's attention than appending them at the end after style instructions.
 *
 * Returns empty string if no guidelines exist.
 */
export async function getGuidelinesPrefix(): Promise<string> {
  const guidelines = await db.imageGuideline.findMany({
    select: { guideline: true },
    orderBy: { occurrences: "desc" },
  });

  if (guidelines.length === 0) return "";

  const numbered = guidelines.map((g, i) => `${i + 1}. ${g.guideline}`).join(" ");
  return `CRITICAL REQUIREMENTS — follow all of these exactly: ${numbered}. `;
}
