export type RateLimitHit = { count: number; remainingMs: number };

export type RateLimitStore = {
  hit(key: string, windowMs: number, now?: number): Promise<RateLimitHit>;
};
