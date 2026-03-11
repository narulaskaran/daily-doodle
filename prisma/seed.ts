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
  // Diverse prompt ideas (richer scenes, multi-character friendly)
  { animal: "bear", action: "browsing shelves and picking out ingredients", scene: "corner grocery store", props: "stacked cans, a shopping basket, produce displays, and hanging price tags" },
  { animal: "cat", action: "arranging bouquets and wrapping flowers", scene: "flower market stall", props: "buckets of roses, ribbon rolls, wrapping paper, a watering can, and a cash register" },
  { animal: "raccoon", action: "sewing a patchwork quilt with a needle and thread", scene: "craft room", props: "fabric scraps, a sewing machine, spools of thread, scissors, and pin cushions" },
  { animal: "hedgehog", action: "glazing pottery on a spinning wheel", scene: "ceramics studio", props: "clay pots, paintbrushes, glaze bottles, a kiln, and drying racks of bowls" },
  { animal: "penguin", action: "rolling out dough and cutting cookie shapes", scene: "holiday kitchen", props: "cookie cutters, a rolling pin, sprinkles, an oven with cookies inside, and a frosting bag" },
  { animal: "fox", action: "stirring a big pot of soup while tasting with a spoon", scene: "country kitchen", props: "a bubbling pot, chopped vegetables, a recipe book, hanging ladles, and herb bundles" },
  { animal: "mouse", action: "building a blanket fort with fairy lights", scene: "living room", props: "draped blankets, string lights, pillows, stuffed animals, and a plate of cookies" },
  { animal: "otter", action: "organizing books by color on tall shelves", scene: "cozy bookshop", props: "towering bookshelves, a rolling ladder, stacked books, a reading nook, and a shop cat" },
  { animal: "deer", action: "paddling a canoe down a gentle stream", scene: "autumn forest river", props: "a wooden canoe, fallen leaves, overhanging branches, a fishing rod, and a packed lunch" },
  { animal: "bunny", action: "flying a kite on a breezy hilltop", scene: "rolling countryside hills", props: "a diamond kite, wildflowers, a picnic blanket, a thermos, and fluffy clouds" },
  { animal: "owl", action: "reading by lantern light in a hollow tree", scene: "enchanted nighttime forest", props: "a glowing lantern, stacked books, fireflies, mushrooms, and a crescent moon" },
  { animal: "cat", action: "stargazing through a rooftop telescope", scene: "city rooftop at night", props: "a telescope, a star chart, a blanket, a thermos of cocoa, and twinkling city lights below" },
  { animal: "hamster", action: "sorting letters and stamping packages at a tiny counter", scene: "village post office", props: "stacked parcels, letter slots, stamps, a scale, and postcard displays" },
  { animal: "turtle", action: "mixing colors and painting a mural on a wall", scene: "street art alley", props: "paint buckets, a step ladder, spray cans, a boombox, and drying paintings" },
  { animal: "panda", action: "hanging lanterns and paper decorations from strings", scene: "festival courtyard", props: "paper lanterns, bunting flags, a food cart, drums, and confetti" },
  { animal: "squirrel", action: "decorating a gingerbread house with icing and candy", scene: "winter cabin kitchen", props: "a gingerbread house, icing bags, gumdrops, candy canes, and powdered sugar" },
  { animal: "koala", action: "driving a little bus packed with luggage on the roof", scene: "winding mountain road", props: "a cute bus, suitcases, a map, road signs, and mountain scenery" },
  { animal: "seal", action: "sailing a small boat with patchwork sails", scene: "calm harbor", props: "a sailboat, buoys, seagulls, a lighthouse, fishing nets, and a dock" },
  { animal: "frog", action: "tending a rooftop garden with rows of vegetables", scene: "urban rooftop garden", props: "planter boxes, tomato vines, a watering can, garden gloves, and a city skyline" },
  { animal: "lamb", action: "picking wildflowers in a meadow with butterflies", scene: "sunlit flower meadow", props: "daisies, sunflowers, a woven basket, butterflies, bees, and a wooden fence" },
  { animal: "hippo", action: "soaking in a claw-foot bathtub surrounded by bubbles", scene: "vintage bathroom", props: "rubber ducks, bubble mountains, bath bombs, candles, fluffy towels, and a bath tray with a book" },
  { animal: "sloth", action: "getting a relaxing spa facial with cucumber slices", scene: "tropical spa room", props: "face masks, cucumber slices, bamboo towels, essential oil bottles, and tropical plants" },
  { animal: "dog", action: "playing drums in a garage band setup", scene: "music garage", props: "a drum kit, electric guitars, amplifiers, music sheets, and band posters on the walls" },
  { animal: "pig", action: "conducting a tiny orchestra of animal friends", scene: "concert hall stage", props: "music stands, violins, a grand piano, a conductor baton, and velvet curtains" },
  { animal: "elephant", action: "peering through a microscope in a cluttered lab", scene: "science laboratory", props: "beakers, test tubes, a microscope, plant specimens, charts on the wall, and safety goggles" },
  { animal: "red panda", action: "building a model rocket at a messy workbench", scene: "inventor workshop", props: "a rocket model, wrenches, blueprints, nuts and bolts, a toolbox, and safety goggles" },
  { animal: "duck", action: "serving tea and pastries from behind a cafe counter", scene: "cozy corner cafe", props: "a coffee machine, tiered cake stands, teacups, a chalkboard menu, and hanging plants" },
  { animal: "giraffe", action: "making bubble tea with colorful toppings", scene: "bubble tea shop", props: "boba cups, tapioca pearls in jars, a blender, flavor syrups, and a neon sign" },
  { animal: "sheep", action: "hanging freshly washed clothes on a line to dry", scene: "sunny backyard", props: "a clothesline, clothespins, a laundry basket, sheets blowing in the wind, and a birdbath" },
  { animal: "lion cub", action: "washing dishes in a sink full of bubbles", scene: "cluttered kitchen", props: "stacked dishes, soap bubbles, a dish rack, sponges, and a window with plants on the sill" },
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
