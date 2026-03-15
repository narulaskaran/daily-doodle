import { db } from "~/server/db";

/**
 * Fetch all image guidelines from the database and format them
 * as a prompt suffix string for image generation.
 *
 * Returns empty string if no guidelines exist.
 */
export async function getGuidelinesPromptSuffix(): Promise<string> {
  const guidelines = await db.imageGuideline.findMany({
    select: { guideline: true },
    orderBy: { occurrences: "desc" },
  });

  if (guidelines.length === 0) return "";

  const rules = guidelines.map((g) => g.guideline).join(" ");
  return ` IMPORTANT RULES: ${rules}`;
}
