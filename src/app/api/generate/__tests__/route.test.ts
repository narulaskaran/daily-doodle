import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    promptIdea: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
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

const mockGenerateImage = vi.fn();
vi.mock("~/lib/replicate", () => ({
  generateImageWithFlux: (...args: unknown[]) => mockGenerateImage(...args),
}));

process.env.GENERATE_API_KEY = "test-gen-key";
process.env.REPLICATE_API_TOKEN = "test-replicate-token";

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
    // Default: empty ideas bank so it uses fallback
    mockFindMany.mockResolvedValue([]);
    // Default mock: generateImageWithFlux returns a Buffer
    mockGenerateImage.mockResolvedValue(Buffer.from(new Uint8Array(8)));
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

  it("uses ideas bank for prompt when none provided", async () => {
    mockFindMany.mockResolvedValue([
      { animal: "chicken", action: "piloting an airplane", scene: "cloud", props: "pilot hat, walkie talkie, peanuts" },
    ]);
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
    const prompt = createCall.data.prompt as string;
    expect(prompt).toContain("chicken");
    expect(prompt).toContain("coloring book page");
  });

  it("falls back to hardcoded components when ideas bank is empty", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({
      id: "fallback-page",
      createdAt: new Date("2025-01-15T12:00:00Z"),
    });

    const req = makeRequest({
      headers: { GENERATE_API_KEY: "test-gen-key" },
      body: {},
    });
    await POST(req);

    const createCall = mockCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    const prompt = createCall.data.prompt as string;
    expect(prompt).toContain("coloring book page");
  });

  it("returns 500 if REPLICATE_API_TOKEN is not set", async () => {
    const origKey = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;

    const req = makeRequest({
      headers: { GENERATE_API_KEY: "test-gen-key" },
      body: { prompt: "test" },
    });
    const response = await POST(req);
    expect(response.status).toBe(500);

    process.env.REPLICATE_API_TOKEN = origKey;
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
