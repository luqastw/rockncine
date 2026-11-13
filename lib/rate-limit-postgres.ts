import type { RateLimitHit, RateLimitStore } from "@/lib/rate-limit-store";

const CLEANUP_PROBABILITY = 0.01;
const EXPIRED_RETENTION = "1 hour";

type Row = { count: number; remainingMs: number };

async function cleanupExpired() {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - ${EXPIRED_RETENTION}::interval`;
}

export const postgresRateLimitStore: RateLimitStore = {
  async hit(key, windowMs): Promise<RateLimitHit> {
    const { prisma } = await import("@/lib/prisma");

    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + (${windowMs}::int * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."resetAt" <= now() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimit"."resetAt" <= now() THEN now() + (${windowMs}::int * interval '1 millisecond')
          ELSE "RateLimit"."resetAt"
        END
      RETURNING
        "count",
        (EXTRACT(EPOCH FROM ("resetAt" - now())) * 1000)::float8 AS "remainingMs"
    `;

    if (Math.random() < CLEANUP_PROBABILITY) {
      cleanupExpired().catch(() => undefined);
    }

    const row = rows[0];
    return { count: Number(row.count), remainingMs: Number(row.remainingMs) };
  },
};
