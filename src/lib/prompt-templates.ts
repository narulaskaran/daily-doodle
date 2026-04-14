/**
 * Prompt template system for generating varied kawaii coloring pages.
 *
 * Instead of a single rigid template that always produces "one centered animal",
 * this module provides multiple composition styles inspired by Coco Wyo's
 * detailed, multi-character, scene-rich coloring pages.
 */

// ---------------------------------------------------------------------------
// Style suffix – appended to every prompt to enforce clean line art
// ---------------------------------------------------------------------------
const STYLE_SUFFIX =
  "Thick, bold, uniform black outlines. Clean simple lines for inner details. " +
  "Pure white background, absolutely no shading, no gradients, no grayscale fills, " +
  "no cross-hatching, no stippling, no screentone. Every enclosed area is pure white. " +
  "Flat 2D line art vector style. Dense with cute small details to color in. " +
  "Kawaii children's coloring book page. " +
  "ABSOLUTELY NO TEXT, letters, words, numbers, or writing of any kind anywhere in the image — " +
  "all signs, boards, labels, and banners must be completely blank with no characters on them.";

// ---------------------------------------------------------------------------
// Composition templates — each produces a structurally different scene
// ---------------------------------------------------------------------------
interface CompositionTemplate {
  /** Human-readable label for debugging */
  name: string;
  /**
   * Build the full prompt. Receives the 4 standard components plus an
   * optional second animal (for multi-character compositions).
   */
  build: (parts: {
    animal: string;
    animal2: string;
    action: string;
    scene: string;
    props: string;
  }) => string;
}

const TEMPLATES: CompositionTemplate[] = [
  // 1. Busy duo scene — two characters interacting
  {
    name: "duo-activity",
    build: ({ animal, animal2, action, scene, props }) =>
      `Black and white line art coloring page. Two kawaii chibi animal friends — ` +
      `a chubby ${animal} and a chubby ${animal2} — ${action} together in a cozy ${scene}. ` +
      `The scene is richly detailed and packed with cute objects: ${props}, ` +
      `plus decorative details like bunting, small plants, jars, and knick-knacks filling every shelf and surface. ` +
      STYLE_SUFFIX,
  },
  // 2. Wide environment scene — character is small, scene dominates
  {
    name: "wide-environment",
    build: ({ animal, action, scene, props }) =>
      `Black and white line art coloring page. A wide, detailed illustration of a cozy ${scene}. ` +
      `A small kawaii chubby ${animal} is ${action} in the middle of the scene. ` +
      `The environment is the star — fill the entire frame with intricate details: ${props}, ` +
      `hanging decorations, patterned wallpaper or tiles, stacked items, tiny potted plants, ` +
      `and whimsical objects on every surface. ` +
      STYLE_SUFFIX,
  },
  // 3. Group activity — three characters together
  {
    name: "group-scene",
    build: ({ animal, animal2, action, scene, props }) =>
      `Black and white line art coloring page. A group of three kawaii chibi animal friends — ` +
      `a ${animal}, a ${animal2}, and a small bird companion — are all ${action} ` +
      `in a bustling cozy ${scene}. ` +
      `The scene is filled edge-to-edge with charming props and details: ${props}, ` +
      `plus bunting flags, stacked boxes, and decorative items everywhere. ` +
      STYLE_SUFFIX,
  },
  // 4. Overhead / bird's-eye view — unique perspective
  {
    name: "overhead-view",
    build: ({ animal, animal2, action, scene, props }) =>
      `Black and white line art coloring page, top-down overhead view looking straight down. ` +
      `A kawaii chubby ${animal} and a kawaii chubby ${animal2} ${action} ` +
      `in a cozy ${scene}, seen from directly above. ` +
      `The scene is arranged in a circular layout and filled with cute objects: ${props}, ` +
      `scattered around on a patterned surface with tiny decorations everywhere. ` +
      STYLE_SUFFIX,
  },
  // 5. Storefront / detailed building scene
  {
    name: "storefront",
    build: ({ animal, animal2, action, scene, props }) =>
      `Black and white line art coloring page. The front view of a charming little kawaii ${scene} shop or building. ` +
      `A chubby ${animal} is the shopkeeper ${action} inside, ` +
      `while a chubby ${animal2} customer approaches the entrance. ` +
      `The storefront has an awning, a blank signboard (no text), window displays filled with ${props}, ` +
      `hanging plants, a door mat, and many small decorative details. ` +
      STYLE_SUFFIX,
  },
  // 6. Vehicle / travel scene — characters on the move
  {
    name: "travel-scene",
    build: ({ animal, animal2, scene, props }) =>
      `Black and white line art coloring page. A kawaii chubby ${animal} and a chubby ${animal2} ` +
      `on a cute adventure, traveling through a ${scene} in an adorable little vehicle ` +
      `(like a tiny car, boat, hot air balloon, or train). ` +
      `The vehicle and surroundings are packed with charming details: ${props}, ` +
      `luggage, maps, snacks, and whimsical decorations. ` +
      STYLE_SUFFIX,
  },
  // 7. Cozy interior — detailed room scene
  {
    name: "cozy-interior",
    build: ({ animal, action, scene, props }) =>
      `Black and white line art coloring page. A cross-section view of a cozy kawaii ${scene} room. ` +
      `A chubby ${animal} is happily ${action} in the center. ` +
      `Every part of the room is filled with cute details: ${props}, ` +
      `shelves lined with jars and books, framed pictures, a rug with patterns, ` +
      `hanging lights, potted plants on windowsills, and tiny objects on every surface. ` +
      STYLE_SUFFIX,
  },
  // 8. Garden / outdoor scene with lots of nature detail
  {
    name: "garden-scene",
    build: ({ animal, animal2, action, scene, props }) =>
      `Black and white line art coloring page. A lush kawaii ${scene} garden scene. ` +
      `A chubby ${animal} and a chubby ${animal2} are ${action} among the greenery. ` +
      `The scene overflows with nature details: ${props}, winding paths, ` +
      `mushrooms, flowers of different types, butterflies, stepping stones, ` +
      `a little fence, watering cans, and garden tools scattered about. ` +
      STYLE_SUFFIX,
  },
];

// ---------------------------------------------------------------------------
// Second animal pool — used when the template needs a companion character
// ---------------------------------------------------------------------------
const COMPANION_ANIMALS = [
  "bunny", "kitten", "duckling", "hamster", "chick", "puppy",
  "frog", "hedgehog", "squirrel", "mouse", "penguin", "otter",
  "raccoon", "panda", "seal", "turtle", "lamb", "fox cub",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Build a complete image generation prompt from the standard 4 components.
 * Randomly selects a composition template for variety.
 */
export function buildPromptFromComponents(parts: {
  animal: string;
  action: string;
  scene: string;
  props: string;
}): string {
  const template = pickOne(TEMPLATES);

  // Pick a second animal that differs from the primary
  let animal2 = pickOne(COMPANION_ANIMALS);
  if (animal2.toLowerCase() === parts.animal.toLowerCase()) {
    // Re-pick once to avoid duplicates
    animal2 = pickOne(COMPANION_ANIMALS.filter(
      (a) => a.toLowerCase() !== parts.animal.toLowerCase(),
    ));
  }

  return template.build({
    ...parts,
    animal2,
  });
}

// ---------------------------------------------------------------------------
// Fallback components (used when the ideas bank is empty)
// ---------------------------------------------------------------------------
export const FALLBACK_ANIMALS = [
  "bear", "cat", "frog", "bunny", "penguin", "fox", "owl",
  "raccoon", "hedgehog", "duck", "mouse", "panda", "otter",
  "turtle", "koala", "puppy", "hamster", "seal",
];

export const FALLBACK_ACTIONS = [
  "relaxing on a towel", "baking cookies", "watering plants",
  "reading a book", "sipping hot cocoa", "painting on a canvas",
  "picking apples", "decorating a cake", "doing yoga",
  "having a picnic", "arranging flowers", "shopping for groceries",
  "making pottery", "wrapping gifts", "setting up a tea party",
];

export const FALLBACK_SCENES = [
  "sunny beach", "kitchen", "greenhouse", "library nook",
  "snowy cabin", "art studio", "orchard", "bakery",
  "bamboo garden", "sunny meadow", "flower market",
  "craft room", "treehouse", "candy shop", "laundromat",
];

export const FALLBACK_PROPS = [
  "a sandcastle, a beach umbrella, and a cooler",
  "a mixing bowl, oven mitts, and a cookie jar",
  "potted plants, a watering can, and little ladybugs",
  "stacked books, a reading lamp, and a warm blanket",
  "a steaming mug, marshmallows, and a cozy fireplace",
  "paint brushes, a palette, and jars of paint",
  "baskets of fruit, glass jars, and hanging herbs",
  "ribbons, wrapping paper, gift boxes, and tape",
  "teacups, a tiered cake stand, and tiny sandwiches",
];

export function buildFallbackPrompt(): string {
  return buildPromptFromComponents({
    animal: pickOne(FALLBACK_ANIMALS),
    action: pickOne(FALLBACK_ACTIONS),
    scene: pickOne(FALLBACK_SCENES),
    props: pickOne(FALLBACK_PROPS),
  });
}
