import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Replicate enforces a 6 requests-per-minute limit on low-credit accounts.
// We mirror that limit in Redis (via Upstash) so distributed serverless
// invocations coordinate before hitting Replicate, avoiding 429 errors.
const REQUESTS_PER_MINUTE = 6;
const WINDOW = "60 s";

let _ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(REQUESTS_PER_MINUTE, WINDOW),
      analytics: true,
      prefix: "replicate:image:ratelimit",
    });
  }
  return _ratelimit;
}

// Local minimum delay (ms) between Replicate calls to stay within the
// 6 req/min (i.e. 1 req per 10s) burst-1 rate limit on low-credit accounts.
const MIN_DELAY_MS = 10_000;
let _lastCallTime = 0;

/**
 * Acquires a rate-limit token for a Replicate image generation request.
 *
 * Always enforces a local minimum delay between calls (10s) to respect the
 * burst-1 rate limit. Additionally uses Redis (via Upstash) for distributed
 * coordination when configured.
 */
export async function acquireReplicateRateLimit(): Promise<void> {
  // Local delay — works even without Redis
  const now = Date.now();
  const elapsed = now - _lastCallTime;
  if (_lastCallTime > 0 && elapsed < MIN_DELAY_MS) {
    const waitMs = MIN_DELAY_MS - elapsed;
    console.log(
      `Replicate local rate limit: waiting ${Math.ceil(waitMs / 1000)}s before next request...`,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
  _lastCallTime = Date.now();

  // Distributed Redis rate limit (if configured)
  const limiter = getRatelimit();
  if (!limiter) return;

  let result = await limiter.limit("global");

  while (!result.success) {
    // `reset` is the Unix timestamp (ms) when the oldest token in the window
    // expires, freeing up capacity. Add a small buffer for clock skew.
    const waitMs = Math.max(result.reset - Date.now(), 0) + 500;
    console.log(
      `Replicate rate limit reached. Waiting ${Math.ceil(waitMs / 1000)}s for window reset...`,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    result = await limiter.limit("global");
  }
}
