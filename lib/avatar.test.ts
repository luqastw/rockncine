import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR_SRC,
  avatarSrc,
  isAvatarUserId,
  parseAvatarVersion,
} from "./avatar";

const CUID = "cm1abcdefghij0123456789xy";

describe("parseAvatarVersion", () => {
  it("aceita inteiro positivo seguro", () => {
    expect(parseAvatarVersion(1)).toBe(1);
    expect(parseAvatarVersion(1731585600000)).toBe(1731585600000);
    expect(parseAvatarVersion(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    ["javascript:alert(1)"],
    ["https://evil.example/x.png"],
    [-1],
    [0],
    [1.5],
    [Number.NaN],
    ["123"],
    [{}],
    [{ v: 1 }],
    [null],
    [undefined],
    [Number.MAX_SAFE_INTEGER + 1],
    [Number.POSITIVE_INFINITY],
  ])("rejeita %o", (value) => {
    expect(parseAvatarVersion(value)).toBeUndefined();
  });
});

describe("isAvatarUserId", () => {
  it("aceita cuid de 25 caracteres e limites", () => {
    expect(CUID).toHaveLength(25);
    expect(isAvatarUserId(CUID)).toBe(true);
    expect(isAvatarUserId("a")).toBe(true);
    expect(isAvatarUserId("a".repeat(64))).toBe(true);
    expect(isAvatarUserId("a_b-C9")).toBe(true);
  });

  it.each([
    [".."],
    ["a/b"],
    ["a b"],
    [""],
    ["a".repeat(65)],
    ["a.b"],
    [null],
    [undefined],
    [123],
    [{}],
  ])("rejeita %o", (value) => {
    expect(isAvatarUserId(value)).toBe(false);
  });
});

describe("avatarSrc", () => {
  it("monta a url com id e versao validos", () => {
    expect(avatarSrc(CUID, 42)).toBe(`/api/avatar/${CUID}?v=42`);
  });

  it("devolve o padrao quando a versao e invalida", () => {
    const invalid = [
      "javascript:alert(1)",
      "https://evil.example/x.png",
      -1,
      0,
      1.5,
      Number.NaN,
      "123",
      {},
      null,
      undefined,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    for (const version of invalid) {
      const src = avatarSrc(CUID, version);
      expect(src).toBe(DEFAULT_AVATAR_SRC);
      expect(src).not.toContain("javascript:");
      expect(src).not.toContain("http");
    }
  });

  it("devolve o padrao quando o userId e invalido", () => {
    const invalid = ["..", "a/b", "a b", "", "a".repeat(65), null, undefined, 1];
    for (const userId of invalid) {
      const src = avatarSrc(userId, 1);
      expect(src).toBe(DEFAULT_AVATAR_SRC);
      expect(src).not.toContain("javascript:");
      expect(src).not.toContain("http");
    }
  });

  it("devolve o padrao quando ambos sao invalidos", () => {
    expect(avatarSrc("../x", "javascript:alert(1)")).toBe(DEFAULT_AVATAR_SRC);
  });
});
