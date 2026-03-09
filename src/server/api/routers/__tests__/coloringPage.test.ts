import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { setupTestDb, cleanupTestDb } from "~/test/db";

// Mock the db module to use our test database
let testDb: PrismaClient;

vi.mock("~/server/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mocking
const { coloringPageRouter } = await import("~/server/api/routers/coloringPage");
const { createCallerFactory } = await import("~/server/api/trpc");

const createCaller = createCallerFactory(coloringPageRouter);

function getCaller() {
  return createCaller({
    db: testDb,
    session: null,
    headers: new Headers(),
  });
}

describe("coloringPage router", () => {
  beforeAll(() => {
    testDb = setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb(testDb);
  });

  beforeEach(async () => {
    await testDb.coloringPage.deleteMany();
  });

  describe("getAll", () => {
    it("returns only approved pages", async () => {
      await testDb.coloringPage.createMany({
        data: [
          { id: "1", title: "Approved", slug: "approved", approved: true, updatedAt: new Date() },
          { id: "2", title: "Pending", slug: "pending", approved: null, updatedAt: new Date() },
          { id: "3", title: "Rejected", slug: "rejected", approved: false, updatedAt: new Date() },
        ],
      });

      const caller = getCaller();
      const result = await caller.getAll({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe("Approved");
    });

    it("returns empty when no approved pages exist", async () => {
      await testDb.coloringPage.create({
        data: { id: "1", title: "Pending", slug: "pending", approved: null, updatedAt: new Date() },
      });

      const caller = getCaller();
      const result = await caller.getAll({});

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("respects limit parameter", async () => {
      // Create 5 approved pages
      for (let i = 0; i < 5; i++) {
        await testDb.coloringPage.create({
          data: {
            id: `page-${i}`,
            title: `Page ${i}`,
            slug: `page-${i}`,
            approved: true,
            createdAt: new Date(Date.now() - i * 1000),
            updatedAt: new Date(),
          },
        });
      }

      const caller = getCaller();
      const result = await caller.getAll({ limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeDefined();
    });

    it("handles cursor-based pagination", async () => {
      // Create pages with distinct timestamps
      for (let i = 0; i < 5; i++) {
        await testDb.coloringPage.create({
          data: {
            id: `page-${i}`,
            title: `Page ${i}`,
            slug: `page-${i}`,
            approved: true,
            createdAt: new Date(Date.now() - i * 1000),
            updatedAt: new Date(),
          },
        });
      }

      const caller = getCaller();

      // First page
      const page1 = await caller.getAll({ limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      // Second page using cursor
      const page2 = await caller.getAll({ limit: 2, cursor: page1.nextCursor });
      expect(page2.items).toHaveLength(2);

      // Items should be different
      const page1Ids = page1.items.map((i) => i.id);
      const page2Ids = page2.items.map((i) => i.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it("orders by createdAt desc", async () => {
      await testDb.coloringPage.create({
        data: { id: "old", title: "Old", slug: "old", approved: true, createdAt: new Date("2024-01-01"), updatedAt: new Date() },
      });
      await testDb.coloringPage.create({
        data: { id: "new", title: "New", slug: "new", approved: true, createdAt: new Date("2025-01-01"), updatedAt: new Date() },
      });

      const caller = getCaller();
      const result = await caller.getAll({});

      expect(result.items[0]!.id).toBe("new");
      expect(result.items[1]!.id).toBe("old");
    });

    it("uses default limit of 20", async () => {
      const caller = getCaller();
      // Just ensure it doesn't throw with default params
      const result = await caller.getAll();
      expect(result.items).toBeDefined();
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("getBySlug", () => {
    it("returns an approved page by slug", async () => {
      await testDb.coloringPage.create({
        data: { id: "1", title: "Dino", slug: "dino-page", approved: true, updatedAt: new Date() },
      });

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "dino-page" });

      expect(result).not.toBeNull();
      expect(result!.title).toBe("Dino");
    });

    it("returns null for unapproved page", async () => {
      await testDb.coloringPage.create({
        data: { id: "1", title: "Pending", slug: "pending-page", approved: null, updatedAt: new Date() },
      });

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "pending-page" });

      expect(result).toBeNull();
    });

    it("returns null for rejected page", async () => {
      await testDb.coloringPage.create({
        data: { id: "1", title: "Rejected", slug: "rejected-page", approved: false, updatedAt: new Date() },
      });

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "rejected-page" });

      expect(result).toBeNull();
    });

    it("returns null for non-existent slug", async () => {
      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "does-not-exist" });

      expect(result).toBeNull();
    });
  });
});
