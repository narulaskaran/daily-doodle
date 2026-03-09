import { vi } from "vitest";

// Mock server-only (it throws when imported outside RSC)
vi.mock("server-only", () => ({}));

// Mock next-auth
vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

// Mock ~/server/auth
vi.mock("~/server/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}));

// Set env vars for testing
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
(process.env as Record<string, string>).NODE_ENV = "test";
