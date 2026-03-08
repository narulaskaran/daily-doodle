import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/db.sqlite",
});
const db = new PrismaClient({ adapter });

const samplePages = [
  {
    title: "Cozy Reading Nook",
    slug: "cozy-reading-nook",
    description:
      "A warm reading corner with stacked books, a steaming mug, and a plush armchair.",
    pdfUrl: "https://example.com/placeholder.pdf",
    pdfKey: "seed-cozy-reading-nook",
  },
  {
    title: "Kitchen Cat",
    slug: "kitchen-cat",
    description:
      "A fluffy cat perched on a kitchen counter surrounded by jars and plants.",
    pdfUrl: "https://example.com/placeholder.pdf",
    pdfKey: "seed-kitchen-cat",
  },
  {
    title: "Garden Gnome",
    slug: "garden-gnome",
    description:
      "A cheerful gnome tending to oversized mushrooms and sunflowers.",
    pdfUrl: "https://example.com/placeholder.pdf",
    pdfKey: "seed-garden-gnome",
  },
  {
    title: "Desk Jungle",
    slug: "desk-jungle",
    description:
      "A cluttered desk with potted plants, pencil cups, and a friendly succulent.",
    pdfUrl: "https://example.com/placeholder.pdf",
    pdfKey: "seed-desk-jungle",
  },
  {
    title: "Rainy Window",
    slug: "rainy-window",
    description:
      "A window sill scene with raindrops, a candle, and a sleeping puppy.",
    pdfUrl: "https://example.com/placeholder.pdf",
    pdfKey: "seed-rainy-window",
  },
];

async function main() {
  console.log("Seeding coloring pages...");

  for (const page of samplePages) {
    await db.coloringPage.upsert({
      where: { slug: page.slug },
      update: page,
      create: page,
    });
    console.log(`  ✓ ${page.title}`);
  }

  console.log(`Seeded ${samplePages.length} coloring pages.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
