import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("~/server/db", () => ({
  db: {},
}));

// Import after mocking
const { coloringPageRouter } = await import("~/server/api/routers/coloringPage");
const { createCallerFactory } = await import("~/server/api/trpc");

const createCaller = createCallerFactory(coloringPageRouter);

function getCaller() {
  return createCaller({
    db: {
      coloringPage: {
        findMany: mockFindMany,
        findFirst: mockFindFirst,
      },
    } as unknown as PrismaClient,
    session: null,
    headers: new Headers(),
  });
}

const makePages = (count: number, overrides: Record<string, unknown> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `page-${i}`,
    title: `Page ${i}`,
    slug: `page-${i}`,
    approved: true,
    createdAt: new Date(Date.now() - i * 1000),
    updatedAt: new Date(),
    description: null,
    prompt: null,
    imageUrl: null,
    imageKey: null,
    pdfUrl: "",
    pdfKey: "",
    thumbnailUrl: null,
    ...overrides,
  }));

describe("coloringPage router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAll", () => {
    it("returns only approved pages", async () => {
      mockFindMany.mockResolvedValue(makePages(1));

      const caller = getCaller();
      const result = await caller.getAll({});

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { approved: true } }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe("Page 0");
    });

    it("returns empty when no approved pages exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const caller = getCaller();
      const result = await caller.getAll({});

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("sets nextCursor when more results exist beyond limit", async () => {
      // Return limit+1 items to signal there are more pages
      mockFindMany.mockResolvedValue(makePages(3));

      const caller = getCaller();
      const result = await caller.getAll({ limit: 2 });

      expect(result.items).toHaveLength(2);
      // nextCursor is the id of the extra (limit+1) item that was popped
      expect(result.nextCursor).toBe("page-2");
    });

    it("does not set nextCursor when results fit within limit", async () => {
      mockFindMany.mockResolvedValue(makePages(2));

      const caller = getCaller();
      const result = await caller.getAll({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it("passes cursor to findMany when provided", async () => {
      mockFindMany.mockResolvedValue(makePages(2));

      const caller = getCaller();
      await caller.getAll({ limit: 2, cursor: "some-cursor-id" });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "some-cursor-id" },
          skip: 1,
        }),
      );
    });

    it("orders by createdAt desc", async () => {
      mockFindMany.mockResolvedValue([]);

      const caller = getCaller();
      await caller.getAll({});

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: "desc" } }),
      );
    });

    it("uses default limit of 20", async () => {
      mockFindMany.mockResolvedValue([]);

      const caller = getCaller();
      await caller.getAll();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 21 }),
      );
    });
  });

  describe("getBySlug", () => {
    it("returns an approved page by slug", async () => {
      mockFindFirst.mockResolvedValue(makePages(1)[0]);

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "dino-page" });

      expect(result).not.toBeNull();
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: "dino-page", approved: true },
        }),
      );
    });

    it("returns null for unapproved page", async () => {
      mockFindFirst.mockResolvedValue(null);

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "pending-page" });

      expect(result).toBeNull();
    });

    it("returns null for non-existent slug", async () => {
      mockFindFirst.mockResolvedValue(null);

      const caller = getCaller();
      const result = await caller.getBySlug({ slug: "does-not-exist" });

      expect(result).toBeNull();
    });
  });
});
