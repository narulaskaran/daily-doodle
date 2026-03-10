import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROMPT_COMBOS = [
  { animal: "bear", action: "relaxing on a towel", scene: "sunny beach", props: "a sandcastle, a beach umbrella, and a cooler" },
  { animal: "cat", action: "baking cookies", scene: "kitchen", props: "a mixing bowl, oven mitts, and a cookie jar" },
  { animal: "frog", action: "watering plants", scene: "greenhouse", props: "potted plants, a watering can, and little ladybugs" },
  { animal: "dinosaur", action: "picking flowers", scene: "garden", props: "a watering can, potted plants, and butterflies" },
  { animal: "bunny", action: "reading a book", scene: "library nook", props: "stacked books, a reading lamp, and a warm blanket" },
  { animal: "penguin", action: "sipping hot cocoa", scene: "snowy cabin", props: "a steaming mug, marshmallows, and a cozy fireplace" },
  { animal: "fox", action: "painting on a canvas", scene: "art studio", props: "paint brushes, a palette, and jars of paint" },
  { animal: "owl", action: "stargazing through a telescope", scene: "rooftop at night", props: "a telescope, twinkling stars, and a crescent moon" },
  { animal: "raccoon", action: "selling lemonade", scene: "sunny neighborhood", props: "a lemonade stand, cups, and a pitcher of lemonade" },
  { animal: "hedgehog", action: "picking apples", scene: "orchard", props: "apple trees, a basket, and fallen leaves" },
  { animal: "duck", action: "splashing in puddles", scene: "rainy park", props: "rain boots, an umbrella, and raindrops" },
  { animal: "mouse", action: "decorating a cake", scene: "bakery", props: "frosting bags, sprinkles, and a tiered cake" },
  { animal: "elephant", action: "planting seeds", scene: "vegetable garden", props: "seed packets, a trowel, and tiny sprouts" },
  { animal: "panda", action: "doing yoga", scene: "bamboo garden", props: "a yoga mat, bamboo stalks, and cherry blossoms" },
  { animal: "otter", action: "floating on its back", scene: "gentle river", props: "lily pads, a little fish, and reeds" },
  { animal: "turtle", action: "having a picnic", scene: "sunny meadow", props: "a checkered blanket, a basket, and sandwiches" },
  { animal: "squirrel", action: "roasting marshmallows", scene: "campfire scene", props: "a campfire, marshmallow sticks, and a tent" },
  { animal: "sheep", action: "knitting a scarf", scene: "cozy living room", props: "yarn balls, knitting needles, and a rocking chair" },
  { animal: "pig", action: "splashing in a mud bath", scene: "farm", props: "a wooden fence, sunflowers, and a barn" },
  { animal: "koala", action: "napping in a tree", scene: "eucalyptus forest", props: "eucalyptus leaves, butterflies, and fluffy clouds" },
  { animal: "dog", action: "catching frisbees", scene: "sunny park", props: "a frisbee, a park bench, and daisies" },
  { animal: "giraffe", action: "reaching for fruit", scene: "savanna", props: "tall trees, birds, and fluffy clouds" },
  { animal: "hamster", action: "running on a wheel", scene: "cozy hamster home", props: "a hamster wheel, wood shavings, and sunflower seeds" },
  { animal: "deer", action: "drinking from a stream", scene: "enchanted forest", props: "mushrooms, ferns, and fireflies" },
  { animal: "sloth", action: "hanging from a branch", scene: "tropical rainforest", props: "vines, tropical flowers, and a toucan" },
  { animal: "seal", action: "balancing a ball on its nose", scene: "seaside dock", props: "a beach ball, seagulls, and waves" },
  { animal: "rabbit", action: "tending a carrot patch", scene: "country garden", props: "carrots, a garden gate, and bumblebees" },
  { animal: "lion cub", action: "chasing butterflies", scene: "grassy savanna", props: "tall grass, butterflies, and wildflowers" },
  { animal: "hippo", action: "taking a bubble bath", scene: "bathroom", props: "rubber ducks, bubbles, and a shower cap" },
  { animal: "red panda", action: "eating bamboo shoots", scene: "misty mountain", props: "bamboo, cherry blossoms, and stepping stones" },
];

async function main() {
  console.log("Seeding prompt ideas...");

  // Upsert each combo - skip if an identical combo already exists
  let created = 0;
  let skipped = 0;

  for (const combo of PROMPT_COMBOS) {
    const existing = await prisma.promptIdea.findFirst({
      where: {
        animal: combo.animal,
        action: combo.action,
        scene: combo.scene,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.promptIdea.create({
      data: {
        animal: combo.animal,
        action: combo.action,
        scene: combo.scene,
        props: combo.props,
        used: false,
      },
    });
    created++;
  }

  console.log(`Done: ${created} created, ${skipped} skipped (already exist)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
