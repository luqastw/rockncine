import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientIpFromHeaders, resetRateLimitBuckets } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("permite exatamente `limit` requisições e bloqueia a seguinte", () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };

    expect(checkRateLimit("a", opts).allowed).toBe(true);
    expect(checkRateLimit("a", opts).allowed).toBe(true);
    expect(checkRateLimit("a", opts).allowed).toBe(true);

    const blocked = checkRateLimit("a", opts);
    expect(blocked.allowed).toBe(false);
  });

  it("devolve retryAfterSeconds coerente com a janela restante", () => {
    checkRateLimit("b", { limit: 1, windowMs: 60_000, now: 0 });
    const blocked = checkRateLimit("b", { limit: 1, windowMs: 60_000, now: 30_000 });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBe(30);
    }
  });

  it("libera de novo depois da janela", () => {
    checkRateLimit("c", { limit: 1, windowMs: 1000, now: 0 });
    expect(checkRateLimit("c", { limit: 1, windowMs: 1000, now: 500 }).allowed).toBe(false);
    expect(checkRateLimit("c", { limit: 1, windowMs: 1000, now: 1000 }).allowed).toBe(true);
  });

  it("isola contadores por chave", () => {
    checkRateLimit("d", { limit: 1, windowMs: 1000, now: 0 });
    expect(checkRateLimit("d", { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(false);
    expect(checkRateLimit("e", { limit: 1, windowMs: 1000, now: 0 }).allowed).toBe(true);
  });

  it("nunca devolve retryAfterSeconds menor que 1", () => {
    checkRateLimit("f", { limit: 1, windowMs: 1000, now: 0 });
    const blocked = checkRateLimit("f", { limit: 1, windowMs: 1000, now: 999 });

    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
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
