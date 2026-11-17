import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RECENT_EMOJIS_KEY,
  loadRecents,
  pushRecent,
  saveRecents,
} from "@/components/room/chat/recentEmojis";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("pushRecent", () => {
  it("coloca o mais recente primeiro", () => {
    expect(pushRecent(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("remove duplicata e sobe o emoji", () => {
    expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("limita a oito", () => {
    const base = Array.from({ length: 8 }, (_, index) => `e${index}`);
    const next = pushRecent(base, "novo");
    expect(next).toHaveLength(8);
    expect(next[0]).toBe("novo");
    expect(next).not.toContain("e7");
  });
});

describe("loadRecents e saveRecents", () => {
  it("grava e lê de volta", () => {
    saveRecents(["🔥", "❤️"]);
    expect(window.localStorage.getItem(RECENT_EMOJIS_KEY)).toBe(JSON.stringify(["🔥", "❤️"]));
    expect(loadRecents()).toEqual(["🔥", "❤️"]);
  });

  it("devolve lista vazia sem nada salvo", () => {
    expect(loadRecents()).toEqual([]);
  });

  it("ignora JSON corrompido", () => {
    window.localStorage.setItem(RECENT_EMOJIS_KEY, "{nao e json");
    expect(loadRecents()).toEqual([]);
  });

  it("ignora formato inesperado", () => {
    window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify({ a: 1 }));
    expect(loadRecents()).toEqual([]);
  });

  it("filtra itens inválidos, duplicados e excesso", () => {
    const raw = ["🔥", 3, "", "🔥", "x".repeat(40), ...Array.from({ length: 20 }, (_, i) => `e${i}`)];
    window.localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(raw));
    const result = loadRecents();
    expect(result).toHaveLength(8);
    expect(result[0]).toBe("🔥");
    expect(result.filter((item) => item === "🔥")).toHaveLength(1);
  });

  it("não quebra quando o storage lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cheio");
    });
    expect(loadRecents()).toEqual([]);
    expect(() => saveRecents(["🔥"])).not.toThrow();
  });
});
