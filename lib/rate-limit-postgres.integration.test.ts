// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.RATE_LIMIT_INTEGRATION_URL;

describe.skipIf(!url)("postgresRateLimitStore contra Postgres real", () => {
  let store: typeof import("./rate-limit-postgres").postgresRateLimitStore;
  let prisma: typeof import("./prisma").prisma;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url as string);
    ({ prisma } = await import("./prisma"));
    ({ postgresRateLimitStore: store } = await import("./rate-limit-postgres"));
    await prisma.$executeRaw`DELETE FROM "RateLimit"`;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    vi.unstubAllEnvs();
  });

  it("incrementa o contador dentro da janela", async () => {
    const first = await store.hit("it:seq", 60_000);
    const second = await store.hit("it:seq", 60_000);
    const third = await store.hit("it:seq", 60_000);

    expect([first.count, second.count, third.count]).toEqual([1, 2, 3]);
    expect(third.remainingMs).toBeGreaterThan(0);
    expect(third.remainingMs).toBeLessThanOrEqual(60_000);
  });

  it("reinicia o contador depois que a janela vence", async () => {
    await store.hit("it:expire", 200);
    await store.hit("it:expire", 200);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const afterWindow = await store.hit("it:expire", 200);

    expect(afterWindow.count).toBe(1);
  });

  it("isola contadores por chave", async () => {
    await store.hit("it:a", 60_000);
    const other = await store.hit("it:b", 60_000);

    expect(other.count).toBe(1);
  });

  it("conta cada requisição concorrente exatamente uma vez", async () => {
    const hits = await Promise.all(
      Array.from({ length: 25 }, () => store.hit("it:concurrent", 60_000)),
    );

    const counts = hits.map((hit) => hit.count).sort((a, b) => a - b);
    expect(counts).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});
