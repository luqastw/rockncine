import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientIpFromHeaders, resetRateLimitBuckets } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("permite exatamente `limit` requisições e bloqueia a seguinte", async () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };

    expect((await checkRateLimit("a", opts)).allowed).toBe(true);
    expect((await checkRateLimit("a", opts)).allowed).toBe(true);
    expect((await checkRateLimit("a", opts)).allowed).toBe(true);
    expect((await checkRateLimit("a", opts)).allowed).toBe(false);
  });

  it("informa quantas requisições ainda restam", async () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };

    expect(await checkRateLimit("r", opts)).toEqual({ allowed: true, remaining: 2 });
    expect(await checkRateLimit("r", opts)).toEqual({ allowed: true, remaining: 1 });
    expect(await checkRateLimit("r", opts)).toEqual({ allowed: true, remaining: 0 });
  });

  it("devolve retryAfterSeconds coerente com a janela restante", async () => {
    await checkRateLimit("b", { limit: 1, windowMs: 60_000, now: 0 });
    const blocked = await checkRateLimit("b", { limit: 1, windowMs: 60_000, now: 30_000 });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBe(30);
    }
  });

  it("libera de novo depois da janela", async () => {
    await checkRateLimit("c", { limit: 1, windowMs: 1000, now: 0 });
    expect((await checkRateLimit("c", { limit: 1, windowMs: 1000, now: 500 })).allowed).toBe(false);
    expect((await checkRateLimit("c", { limit: 1, windowMs: 1000, now: 1000 })).allowed).toBe(true);
  });

  it("isola contadores por chave", async () => {
    await checkRateLimit("d", { limit: 1, windowMs: 1000, now: 0 });
    expect((await checkRateLimit("d", { limit: 1, windowMs: 1000, now: 0 })).allowed).toBe(false);
    expect((await checkRateLimit("e", { limit: 1, windowMs: 1000, now: 0 })).allowed).toBe(true);
  });

  it("nunca devolve retryAfterSeconds menor que 1", async () => {
    await checkRateLimit("f", { limit: 1, windowMs: 1000, now: 0 });
    const blocked = await checkRateLimit("f", { limit: 1, windowMs: 1000, now: 999 });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("checkRateLimit com store Postgres", () => {
  const queryRaw = vi.fn();
  const executeRaw = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RATE_LIMIT_STORE", "postgres");
    vi.doMock("@/lib/prisma", () => ({
      prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw },
    }));
    queryRaw.mockReset();
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/prisma");
    vi.restoreAllMocks();
  });

  it("libera quando a contagem do banco está dentro do limite", async () => {
    queryRaw.mockResolvedValue([{ count: 2, remainingMs: 40_000 }]);
    const { checkRateLimit: check } = await import("./rate-limit");

    expect(await check("k", { limit: 3, windowMs: 60_000 })).toEqual({ allowed: true, remaining: 1 });
  });

  it("bloqueia e calcula retryAfterSeconds a partir do tempo restante do banco", async () => {
    queryRaw.mockResolvedValue([{ count: 4, remainingMs: 12_300 }]);
    const { checkRateLimit: check } = await import("./rate-limit");

    expect(await check("k", { limit: 3, windowMs: 60_000 })).toEqual({
      allowed: false,
      retryAfterSeconds: 13,
    });
  });

  it("libera a requisição quando o banco falha", async () => {
    queryRaw.mockRejectedValue(new Error("conexão recusada"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { checkRateLimit: check } = await import("./rate-limit");

    expect(await check("k", { limit: 3, windowMs: 60_000 })).toEqual({ allowed: true, remaining: 3 });
  });
});

describe("clientIpFromHeaders", () => {
  it("usa o primeiro IP de x-forwarded-for", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).toBe("203.0.113.7");
  });

  it("cai para x-real-ip quando não há x-forwarded-for", () => {
    expect(clientIpFromHeaders({ "x-real-ip": "198.51.100.4" })).toBe("198.51.100.4");
  });

  it("devolve 'desconhecido' sem nenhum header de IP", () => {
    expect(clientIpFromHeaders({})).toBe("desconhecido");
  });

  it("ignora x-forwarded-for vazio e cai para x-real-ip", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "   ", "x-real-ip": "198.51.100.9" })).toBe(
      "198.51.100.9",
    );
  });

  it("funciona com Headers do fetch", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.99" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.99");
  });
});
