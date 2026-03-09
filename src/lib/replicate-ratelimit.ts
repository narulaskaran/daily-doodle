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

/**
 * Acquires a rate-limit token for a Replicate image generation request.
 *
 * If the 6-rpm limit is already exhausted, this function waits until the
 * sliding window resets and then retries — ensuring the caller can proceed
 * without hitting a 429 from Replicate.
 *
 * No-ops gracefully when Upstash env vars are not configured.
 */
export async function acquireReplicateRateLimit(): Promise<void> {
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
