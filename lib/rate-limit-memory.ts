import type { RateLimitHit, RateLimitStore } from "@/lib/rate-limit-store";

type Bucket = { count: number; resetAt: number };

const MAX_TRACKED_KEYS = 10_000;

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_TRACKED_KEYS) buckets.clear();
}

export const memoryRateLimitStore: RateLimitStore = {
  async hit(key, windowMs, now = Date.now()): Promise<RateLimitHit> {
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (buckets.size >= MAX_TRACKED_KEYS) prune(now);
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, remainingMs: windowMs };
    }

    bucket.count += 1;
    return { count: bucket.count, remainingMs: bucket.resetAt - now };
  },
};

export function resetMemoryRateLimitStore() {
  buckets.clear();
}
