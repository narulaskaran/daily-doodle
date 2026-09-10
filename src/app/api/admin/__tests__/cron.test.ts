import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    appSetting: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

process.env.GENERATE_API_KEY = "test-api-key";

const { GET, PATCH } = await import("~/app/api/admin/cron/route");

function makeRequest(
  method: string,
  opts?: { headers?: Record<string, string>; body?: unknown; url?: string },
) {
  const url = opts?.url ?? "http://localhost:3000/api/admin/cron";
  const headers = new Headers(opts?.headers);
  const init: { method: string; headers: Headers; body?: string } = { method, headers };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    headers.set("Content-Type", "application/json");
  }
  return new NextRequest(url, init);
}

describe("GET /api/admin/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("GET");
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("returns paused false when no setting exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = makeRequest("GET", {
      headers: { Authorization: "Bearer test-api-key" },
    });
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paused).toBe(false);
  });

  it("returns paused true when the cron is paused", async () => {
    mockFindUnique.mockResolvedValue({ value: "true" });
    const req = makeRequest("GET", {
      url: "http://localhost:3000/api/admin/cron?api_key=test-api-key",
    });
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.paused).toBe(true);
  });
});

describe("PATCH /api/admin/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without auth", async () => {
    const req = makeRequest("PATCH", { body: { paused: true } });
    const response = await PATCH(req);
    expect(response.status).toBe(401);
  });

  it("returns 400 if paused is missing", async () => {
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: {},
    });
    const response = await PATCH(req);
    expect(response.status).toBe(400);
  });

  it("pauses the daily generation cron", async () => {
    mockUpsert.mockResolvedValue({ value: "true" });
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: { paused: true },
    });
    const response = await PATCH(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paused).toBe(true);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("unpauses the daily generation cron", async () => {
    mockUpsert.mockResolvedValue({ value: "false" });
    const req = makeRequest("PATCH", {
      headers: { Authorization: "Bearer test-api-key" },
      body: { paused: false },
    });
    const response = await PATCH(req);
    const data = await response.json();

    expect(data.paused).toBe(false);
  });
});
