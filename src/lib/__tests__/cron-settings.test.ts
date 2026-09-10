import { describe, it, expect, vi, beforeEach } from "vitest";

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

const {
  isGenerateDailyCronPaused,
  setGenerateDailyCronPaused,
  GENERATE_DAILY_CRON_PAUSED_KEY,
} = await import("~/lib/cron-settings");

describe("isGenerateDailyCronPaused", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when no setting exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await isGenerateDailyCronPaused()).toBe(false);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { key: GENERATE_DAILY_CRON_PAUSED_KEY },
    });
  });

  it("returns true when the setting value is true", async () => {
    mockFindUnique.mockResolvedValue({
      key: GENERATE_DAILY_CRON_PAUSED_KEY,
      value: "true",
    });
    expect(await isGenerateDailyCronPaused()).toBe(true);
  });

  it("returns false when the setting value is false", async () => {
    mockFindUnique.mockResolvedValue({
      key: GENERATE_DAILY_CRON_PAUSED_KEY,
      value: "false",
    });
    expect(await isGenerateDailyCronPaused()).toBe(false);
  });
});

describe("setGenerateDailyCronPaused", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts true and returns paused", async () => {
    mockUpsert.mockResolvedValue({
      key: GENERATE_DAILY_CRON_PAUSED_KEY,
      value: "true",
    });
    expect(await setGenerateDailyCronPaused(true)).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: GENERATE_DAILY_CRON_PAUSED_KEY },
      create: { key: GENERATE_DAILY_CRON_PAUSED_KEY, value: "true" },
      update: { value: "true" },
    });
  });

  it("upserts false and returns unpaused", async () => {
    mockUpsert.mockResolvedValue({
      key: GENERATE_DAILY_CRON_PAUSED_KEY,
      value: "false",
    });
    expect(await setGenerateDailyCronPaused(false)).toBe(false);
  });
});
