import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockDelete = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock("~/lib/uploadthing", () => ({
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Set the API key for auth
process.env.GENERATE_API_KEY = "test-api-key";

const { GET, PATCH, DELETE } = await import("~/app/api/admin/pages/route");

function makeRequest(
  method: string,
  opts?: { headers?: Record<string, string>; body?: unknown; url?: string },
) {
  const url = opts?.url ?? "http://localhost:3000/api/admin/pages";
  const headers = new Headers(opts?.headers);
  const init: { method: string; headers: Headers; body?: string } = { method, headers };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    headers.set("Content-Type", "application/json");
  }
  return new NextRequest(url, init);
}

describe("GET /api/admin/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("GET");
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("authenticates via Bearer token", async () => {
    mockFindMany.mockResolvedValue([]);
    const req = makeRequest("GET", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it("authenticates via query param", async () => {
    mockFindMany.mockResolvedValue([]);
    const req = makeRequest("GET", {
      url: "http://localhost:3000/api/admin/pages?api_key=test-api-key",
    });
    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it("returns pages mapped to admin shape", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "page-1",
        prompt: "A cat",
        description: "desc",
        imageUrl: "https://example.com/cat.png",
        thumbnailUrl: null,
        imageKey: "key-1",
        pdfKey: "",
        createdAt: new Date("2025-01-15T12:00:00Z"),
        approved: true,
        pdfUrl: "",
        revisions: [],
      },
    ]);

    const req = makeRequest("GET", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    const response = await GET(req);
    const data = await response.json();

    expect(data.pages).toHaveLength(1);
    expect(data.pages[0]).toMatchObject({
      id: "page-1",
      prompt: "A cat",
      imageUrl: "https://example.com/cat.png",
      approved: true,
      rejected: false,
    });
  });
});

describe("PATCH /api/admin/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("PATCH", { body: { id: "1", approved: true } });
    const response = await PATCH(req);
    expect(response.status).toBe(401);
  });

  it("returns 400 if id is missing", async () => {
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: { approved: true },
    });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it("returns 400 if neither approved nor chooseRevisionId provided", async () => {
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: { id: "1" },
    });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it("updates approval status", async () => {
    mockUpdate.mockResolvedValue({});
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: { id: "page-1", approved: true },
    });
    const response = await PATCH(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "page-1" },
      data: { approved: true },
    });
  });
});

describe("DELETE /api/admin/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("DELETE", {
      url: "http://localhost:3000/api/admin/pages?id=1",
    });
    const response = await DELETE(req);
    expect(response.status).toBe(401);
  });

  it("returns 400 if id is missing", async () => {
    const req = makeRequest("DELETE", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    const response = await DELETE(req);
    expect(response.status).toBe(400);
  });

  it("deletes page and returns success", async () => {
    mockFindUnique.mockResolvedValue({ id: "page-1", imageKey: null, pdfKey: null });
    mockDelete.mockResolvedValue({});

    const req = makeRequest("DELETE", {
      url: "http://localhost:3000/api/admin/pages?id=page-1",
      headers: { Authorization: "Bearer test-api-key" },
    });
    const response = await DELETE(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "page-1" } });
  });
});
