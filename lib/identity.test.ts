import { describe, expect, it } from "vitest";
import { IDENTITY_TONES, initialsOf, toneOf, toneToken } from "./identity";

describe("initialsOf", () => {
  it("usa a inicial de cada uma das duas primeiras palavras", () => {
    expect(initialsOf("ana maria")).toBe("AM");
    expect(initialsOf("bruno")).toBe("B");
    expect(initialsOf("ana maria da silva")).toBe("AM");
  });

  it("normaliza espaços extras e maiúsculas", () => {
    expect(initialsOf("  ana   maria  ")).toBe("AM");
    expect(initialsOf("bruno")).toBe("B");
  });

  it("cai no ? quando não há nome", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });

  it("pula palavra que não começa com letra", () => {
    // "7B" seria pior que "B": o quadrado da lista de presença existe para
    // identificar, não para caber qualquer caractere.
    expect(initialsOf("7 bruno")).toBe("B");
    expect(initialsOf("🔥 marina")).toBe("M");
  });

  it("mantém acento na inicial", () => {
    expect(initialsOf("álvaro maria")).toBe("ÁM");
  });

  it("usa o primeiro caractere quando o nome não tem letra nenhuma", () => {
    expect(initialsOf("🔥")).toBe("🔥");
  });
});

describe("toneOf", () => {
  it("sempre cai em um tom existente", () => {
    for (let i = 0; i < 200; i++) {
      const tone = toneOf(`user-${i}`);
      expect(Number.isInteger(tone)).toBe(true);
      expect(tone).toBeGreaterThanOrEqual(0);
      expect(tone).toBeLessThan(IDENTITY_TONES);
    }
  });

  it("é estável para o mesmo id", () => {
    expect(toneOf("user-42")).toBe(toneOf("user-42"));
  });

  it("não joga todo mundo no mesmo tom", () => {
    const tons = new Set(Array.from({ length: 50 }, (_, i) => toneOf(`user-${i}`)));
    expect(tons.size).toBeGreaterThan(1);
  });

  it("trata id vazio como o primeiro tom", () => {
    expect(toneOf("")).toBe(0);
  });
});

describe("toneToken", () => {
  it("mapeia o tom no token 1-based", () => {
    expect(toneToken(0)).toBe("var(--id-1)");
    expect(toneToken(3)).toBe("var(--id-4)");
  });

  it("nunca sai do conjunto de tokens", () => {
    expect(toneToken(4)).toBe("var(--id-1)");
    expect(toneToken(-1)).toBe("var(--id-4)");
  });
});