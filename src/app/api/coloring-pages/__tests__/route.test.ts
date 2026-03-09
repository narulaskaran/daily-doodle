import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { GET } = await import("~/app/api/coloring-pages/route");

describe("GET /api/coloring-pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns approved pages mapped to expected shape", async () => {
    mockFindMany.mockResolvedValue([
      {
        slug: "cute-cat",
        imageUrl: "https://example.com/cat.png",
        pdfUrl: "",
        imageKey: "key-123",
        pdfKey: "",
        createdAt: new Date("2025-01-15T12:00:00Z"),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0]).toEqual({
      filename: "cute-cat",
      path: "https://example.com/cat.png",
      createdAt: "2025-01-15T12:00:00.000Z",
      url: "https://example.com/cat.png",
      key: "key-123",
    });
  });

  it("only queries approved pages ordered by createdAt desc", async () => {
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns empty array on error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB down"));

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual([]);
  });

  it("falls back to pdfUrl when imageUrl is null", async () => {
    mockFindMany.mockResolvedValue([
      {
        slug: "pdf-page",
        imageUrl: null,
        pdfUrl: "https://example.com/page.pdf",
        imageKey: null,
        pdfKey: "pdf-key",
        createdAt: new Date("2025-01-15T12:00:00Z"),
      },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(data[0].url).toBe("https://example.com/page.pdf");
    expect(data[0].key).toBe("pdf-key");
  });
});
