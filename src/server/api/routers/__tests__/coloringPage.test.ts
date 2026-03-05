import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { existsSync, unlinkSync } from "fs";
import path from "path";
import Database from "better-sqlite3";

// Mock next-auth and server-only before any imports that trigger them
vi.mock("next-auth", () => ({ default: () => ({}) }));
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({ get: () => null }),
}));
vi.mock("server-only", () => ({}));

import { PrismaClient } from "../../../../../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { appRouter } from "../../root";

const TEST_DB_PATH = path.resolve("prisma/test.sqlite");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let db: InstanceType<typeof PrismaClient>;

beforeAll(() => {
  // Clean up any leftover test DB
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

  // Create test DB with schema using better-sqlite3 directly
  const sqlite = new Database(TEST_DB_PATH);
  sqlite.exec(`
    CREATE TABLE "ColoringPage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "pdfUrl" TEXT NOT NULL,
      "pdfKey" TEXT NOT NULL,
      "thumbnailUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "ColoringPage_slug_key" ON "ColoringPage"("slug");
    CREATE INDEX "ColoringPage_createdAt_idx" ON "ColoringPage"("createdAt");
  `);
  sqlite.close();

  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_URL });
  db = new PrismaClient({ adapter });
});

afterAll(async () => {
  await db.$disconnect();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

beforeEach(async () => {
  await db.coloringPage.deleteMany();
});

function createCaller() {
  return appRouter.createCaller({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: db as any,
    session: null,
    headers: new Headers(),
  });
}

describe("coloringPage router", () => {
  describe("getAll", () => {
    it("returns empty list when no pages exist", async () => {
      const caller = createCaller();
      const result = await caller.coloringPage.getAll();
      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns pages ordered by createdAt desc", async () => {
      await db.coloringPage.create({
        data: {
          title: "First Page",
          slug: "first-page",
          pdfUrl: "https://example.com/1.pdf",
          pdfKey: "key-1",
        },
      });
      // Small delay to ensure different createdAt timestamps
      await new Promise((r) => setTimeout(r, 1100));
      await db.coloringPage.create({
        data: {
          title: "Second Page",
          slug: "second-page",
          pdfUrl: "https://example.com/2.pdf",
          pdfKey: "key-2",
        },
      });

      const caller = createCaller();
      const result = await caller.coloringPage.getAll();

      expect(result.items).toHaveLength(2);
      expect(result.items[0]!.title).toBe("Second Page");
      expect(result.items[1]!.title).toBe("First Page");
    });

    it("supports limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await db.coloringPage.create({
          data: {
            title: `Page ${i}`,
            slug: `page-${i}`,
            pdfUrl: `https://example.com/${i}.pdf`,
            pdfKey: `key-${i}`,
          },
        });
      }

      const caller = createCaller();

      const result = await caller.coloringPage.getAll({ limit: 3 });
      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeDefined();

      const all = await caller.coloringPage.getAll({ limit: 10 });
      expect(all.items).toHaveLength(5);
      expect(all.nextCursor).toBeUndefined();
    });
  });

  describe("getBySlug", () => {
    it("returns a page by slug", async () => {
      await db.coloringPage.create({
        data: {
          title: "My Page",
          slug: "my-page",
          description: "A test page",
          pdfUrl: "https://example.com/test.pdf",
          pdfKey: "key-test",
          thumbnailUrl: "https://example.com/thumb.png",
        },
      });

      const caller = createCaller();
      const result = await caller.coloringPage.getBySlug({ slug: "my-page" });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("My Page");
      expect(result!.description).toBe("A test page");
      expect(result!.pdfUrl).toBe("https://example.com/test.pdf");
      expect(result!.thumbnailUrl).toBe("https://example.com/thumb.png");
    });

    it("returns null for non-existent slug", async () => {
      const caller = createCaller();
      const result = await caller.coloringPage.getBySlug({
        slug: "does-not-exist",
      });
      expect(result).toBeNull();
    });
  });
});
