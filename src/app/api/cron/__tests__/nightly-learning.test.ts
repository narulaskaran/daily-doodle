import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockColoringPageFindMany = vi.fn();
const mockGuidelineFindMany = vi.fn();
const mockGuidelineCreate = vi.fn();
const mockGuidelineUpdate = vi.fn();

vi.mock("~/server/db", () => ({
  db: {
    coloringPage: {
      findMany: (...args: unknown[]) => mockColoringPageFindMany(...args),
    },
    imageGuideline: {
      findMany: (...args: unknown[]) => mockGuidelineFindMany(...args),
      create: (...args: unknown[]) => mockGuidelineCreate(...args),
      update: (...args: unknown[]) => mockGuidelineUpdate(...args),
    },
  },
}));

process.env.CRON_SECRET = "test-cron-secret";
process.env.OPEN_ROUTER_KEY = "test-openrouter-key";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { GET, POST } = await import("~/app/api/cron/nightly-learning/route");

function makeRequest(method = "GET") {
  return new NextRequest("http://localhost:3000/api/cron/nightly-learning", {
    method,
    headers: { Authorization: "Bearer test-cron-secret" },
  });
}

const SAMPLE_PAGES = [
  { approved: true, prompt: "Bunny baking in kitchen", promptComponents: { animal: "bunny", action: "baking", scene: "kitchen", props: "oven mitts" } },
  { approved: true, prompt: "Fox reading in library", promptComponents: { animal: "fox", action: "reading", scene: "library", props: "books" } },
  { approved: false, prompt: "Cat painting in studio with text on sign", promptComponents: { animal: "cat", action: "painting", scene: "studio", props: "brushes" } },
  { approved: false, prompt: "Bunny in garden with bunny friend", promptComponents: { animal: "bunny", action: "gardening", scene: "garden", props: "watering can" } },
];

const SAMPLE_GUIDELINES = [
  { id: "g1", guideline: "Never include text on signs", occurrences: 3 },
  { id: "g2", guideline: "Use thick bold lines", occurrences: 1 },
];

const SAMPLE_LLM_RESPONSE = {
  analysis: "Cat and bunny images appear more frequently in rejections. Text on signs is still appearing despite the existing guideline.",
  diversityProblems: ["Bunny appears in 50% of recent images"],
  guidelineChanges: [
    { action: "new", guideline: "Vary the primary animal — avoid repeating the same animal type within the same week" },
    { action: "update", existingId: "g1", guideline: "Never include any text, letters, or numbers on signs, boards, or any surface in the image" },
  ],
};

describe("GET /api/cron/nightly-learning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockColoringPageFindMany.mockResolvedValue(SAMPLE_PAGES);
    mockGuidelineFindMany.mockResolvedValue(SAMPLE_GUIDELINES);
    mockGuidelineCreate.mockResolvedValue({ id: "new-g" });
    mockGuidelineUpdate.mockResolvedValue({ id: "g1" });
  });

  it("returns 401 with invalid cron secret", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/nightly-learning", {
      method: "GET",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it("calls LLM when sufficient data exists", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(SAMPLE_LLM_RESPONSE) } }],
      }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain("openrouter.ai");
  });

  it("creates new guidelines and updates existing ones from LLM response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(SAMPLE_LLM_RESPONSE) } }],
      }),
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.guidelinesCreated).toBe(1);
    expect(data.guidelinesUpdated).toBe(1);

    // Verify create was called with the new guideline
    expect(mockGuidelineCreate).toHaveBeenCalledWith({
      data: { guideline: "Vary the primary animal — avoid repeating the same animal type within the same week" },
    });

    // Verify update was called on the matching existing guideline
    expect(mockGuidelineUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g1" } }),
    );
  });

  it("returns summary with analysis and diversity problems", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(SAMPLE_LLM_RESPONSE) } }],
      }),
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.imagesAnalyzed.approved).toBe(2);
    expect(data.imagesAnalyzed.rejected).toBe(2);
    expect(data.diversityProblems).toContain("Bunny appears in 50% of recent images");
    expect(data.analysis).toContain("bunny");
  });

  it("skips LLM call when fewer than 3 reviewed images exist", async () => {
    mockColoringPageFindMany.mockResolvedValue([
      { approved: true, prompt: "Bunny baking", promptComponents: null },
    ]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(data.analysis).toBe("Insufficient data");
  });

  it("handles LLM parse failure gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not valid json at all" } }],
      }),
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.guidelinesCreated).toBe(0);
  });

  it("ignores guideline update if existingId does not match any known guideline", async () => {
    const badUpdate = {
      ...SAMPLE_LLM_RESPONSE,
      guidelineChanges: [
        { action: "update", existingId: "nonexistent-id", guideline: "Updated rule" },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(badUpdate) } }],
      }),
    });

    await GET(makeRequest());

    expect(mockGuidelineUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/cron/nightly-learning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockColoringPageFindMany.mockResolvedValue(SAMPLE_PAGES);
    mockGuidelineFindMany.mockResolvedValue(SAMPLE_GUIDELINES);
    mockGuidelineCreate.mockResolvedValue({ id: "new-g" });
    mockGuidelineUpdate.mockResolvedValue({ id: "g1" });
  });

  it("supports manual POST trigger with same auth", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(SAMPLE_LLM_RESPONSE) } }],
      }),
    });

    const response = await POST(makeRequest("POST"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
