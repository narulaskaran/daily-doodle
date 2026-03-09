import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCount = vi.fn();
const mockCreate = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock("~/lib/replicate-ratelimit", () => ({
  acquireReplicateRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/uploadthing", () => ({
  uploadImage: vi.fn().mockResolvedValue({
    url: "https://utfs.io/f/test.png",
    key: "test-key",
    name: "test.png",
    size: 1024,
  }),
  listFiles: vi.fn().mockResolvedValue([]),
}));

const mockRun = vi.fn();
vi.mock("replicate", () => ({
  // Must use function keyword so `new Replicate()` works
  default: vi.fn().mockImplementation(function () {
    return { run: mockRun };
  }),
}));

process.env.REPLICATE_API_TOKEN = "test-replicate-token";
process.env.CRON_SECRET = "test-cron-secret";

const { POST, GET } = await import("~/app/api/cron/generate-daily/route");

function makeRequest(opts?: { headers?: Record<string, string>; body?: unknown }) {
  const headers = new Headers(opts?.headers);
  const init: { method: string; headers: Headers; body?: string } = { method: "POST", headers };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    headers.set("Content-Type", "application/json");
  }
  return new NextRequest("http://localhost:3000/api/cron/generate-daily", init);
}

describe("POST /api/cron/generate-daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: Replicate returns a Blob image
    const mockBlob = new Blob([new Uint8Array(8)], { type: "image/png" });
    mockRun.mockResolvedValue([mockBlob]);
  });

  it("returns 401 with invalid cron secret", async () => {
    const req = makeRequest({
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it("skips generation if already have 4 pages today", async () => {
    mockCount.mockResolvedValue(4);

    const req = makeRequest({
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const response = await POST(req);
    const data = await response.json();

    expect(data.generated).toBe(0);
    expect(data.message).toContain("Already generated 4");
  });

  it("generates pages when under daily limit", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockImplementation(({ data }: { data: { title: string; slug: string } }) =>
      Promise.resolve({ id: `gen-${data.slug}`, ...data, createdAt: new Date() }),
    );

    const req = makeRequest({
      headers: { Authorization: "Bearer test-cron-secret" },
      body: { prompts: ["A cute kitten, line drawing, white background"] },
    });
    const response = await POST(req);
    const data = await response.json();

    expect(data.generated).toBe(1);
    expect(data.results[0].success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("saves page with approved=null (pending review)", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "new-page", ...data, createdAt: new Date() }),
    );

    const req = makeRequest({
      headers: { Authorization: "Bearer test-cron-secret" },
      body: { prompts: ["A friendly dinosaur, line drawing"] },
    });
    await POST(req);

    const createCall = mockCreate.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(createCall.data.approved).toBeNull();
  });

  it("returns 500 if REPLICATE_API_TOKEN is not set", async () => {
    const origKey = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;

    mockCount.mockResolvedValue(0);

    const req = makeRequest({
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const response = await POST(req);
    expect(response.status).toBe(500);

    process.env.REPLICATE_API_TOKEN = origKey;
  });
});

describe("GET /api/cron/generate-daily", () => {
  it("returns API info", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.message).toContain("Daily Doodle Cron");
    expect(data.model).toContain("Flux Schnell");
  });
});
