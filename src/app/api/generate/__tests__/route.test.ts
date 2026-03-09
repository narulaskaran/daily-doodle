import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock("~/lib/uploadthing", () => ({
  uploadImage: vi.fn().mockResolvedValue({
    url: "https://utfs.io/f/generated.png",
    key: "gen-key",
    name: "generated.png",
    size: 2048,
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.GENERATE_API_KEY = "test-gen-key";
process.env.OPEN_ROUTER_KEY = "test-openrouter-key";

const { POST, GET } = await import("~/app/api/generate/route");

function makeRequest(opts?: { headers?: Record<string, string>; body?: unknown }) {
  const headers = new Headers(opts?.headers);
  const init: { method: string; headers: Headers; body?: string } = { method: "POST", headers };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    headers.set("Content-Type", "application/json");
  }
  return new NextRequest("http://localhost:3000/api/generate", init);
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("openrouter.ai")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [{ url: "https://example.com/img.png" }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });
  });

  it("returns 401 without API key", async () => {
    const req = makeRequest({ body: { prompt: "test" } });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("returns 401 with wrong API key", async () => {
    const req = makeRequest({
      headers: { GENERATE_API_KEY: "wrong-key" },
      body: { prompt: "test" },
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("generates and saves a page with custom prompt", async () => {
    mockCreate.mockResolvedValue({
      id: "new-page",
      createdAt: new Date("2025-01-15T12:00:00Z"),
    });

    const req = makeRequest({
      headers: { GENERATE_API_KEY: "test-gen-key" },
      body: { prompt: "A happy elephant, line drawing" },
    });
    const response = await POST(req);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.page.id).toBe("new-page");
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createCall = mockCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data.approved).toBeNull();
    expect(createCall.data.prompt).toBe("A happy elephant, line drawing");
  });

  it("uses default prompt when none provided", async () => {
    mockCreate.mockResolvedValue({
      id: "default-page",
      createdAt: new Date("2025-01-15T12:00:00Z"),
    });

    const req = makeRequest({
      headers: { GENERATE_API_KEY: "test-gen-key" },
      body: {},
    });
    await POST(req);

    const createCall = mockCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data.prompt).toContain("coloring book");
  });
});

describe("GET /api/generate", () => {
  it("returns API info", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.message).toContain("Daily Doodle");
    expect(data.model).toContain("Flux Schnell");
  });
});
