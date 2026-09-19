import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "rockncine-video-quality";

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.restoreAllMocks();
});

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
});

const {
  detectLowEndDevice,
  detectSafari,
  getServerSnapshot,
  parseStoredQuality,
  readStorage,
  saveStoredQuality,
  useVideoQuality,
} = await import("./useVideoQuality");

const DEFAULTS = {
  resolution: "720p",
  fpsLimit: "auto",
  economyMode: false,
  economySuggestionDismissed: false,
} as const;

describe("default state (CA-1.8)", () => {
  it("returns defaults when localStorage is empty", () => {
    expect(readStorage()).toEqual(DEFAULTS);
  });
});

describe("persistence (CA-2.4)", () => {
  it("writes resolution to localStorage and reads it back", () => {
    saveStoredQuality({ ...DEFAULTS, resolution: "480p" });
    expect(readStorage().resolution).toBe("480p");
  });

  it("writes fpsLimit to localStorage and reads it back", () => {
    saveStoredQuality({ ...DEFAULTS, fpsLimit: "30" });
    expect(readStorage().fpsLimit).toBe("30");
  });

  it("writes economyMode to localStorage and reads it back", () => {
    saveStoredQuality({ ...DEFAULTS, economyMode: true });
    expect(readStorage().economyMode).toBe(true);
  });

  it("full round-trip preserves all fields", () => {
    const data = {
      resolution: "480p" as const,
      fpsLimit: "60" as const,
      economyMode: true,
      economySuggestionDismissed: true,
    };
    saveStoredQuality(data);
    expect(readStorage()).toEqual(data);
  });
});

// Um valor legado/corrompido passava direto pelo cast `as StoredQuality` e
// virava `undefined` em RESOLUTION_MAX_HEIGHT — desligando o teto de qualidade
// em silêncio, sem erro nenhum.
describe("parseStoredQuality (validação do que vem do localStorage)", () => {
  it("aceita um objeto completo e válido", () => {
    expect(parseStoredQuality({ ...DEFAULTS, resolution: "480p", fpsLimit: "60" })).toEqual({
      ...DEFAULTS,
      resolution: "480p",
      fpsLimit: "60",
    });
  });

  it("cai no default para valor de fora do union (ex.: resolução futura)", () => {
    const parsed = parseStoredQuality({ ...DEFAULTS, resolution: "1080p" });
    expect(parsed.resolution).toBe("720p");
  });

  it("cai no default para fpsLimit inválido", () => {
    expect(parseStoredQuality({ ...DEFAULTS, fpsLimit: "120" }).fpsLimit).toBe("auto");
  });

  it("cai no default para booleanos de tipo errado", () => {
    const parsed = parseStoredQuality({ ...DEFAULTS, economyMode: "true" });
    expect(parsed.economyMode).toBe(false);
  });

  it("preenche campo ausente com o default, preservando os válidos", () => {
    const parsed = parseStoredQuality({ resolution: "480p" });
    expect(parsed).toEqual({ ...DEFAULTS, resolution: "480p" });
  });

  it("recusa não-objeto (null, string, array, número)", () => {
    for (const value of [null, undefined, "480p", 42, ["720p"]]) {
      expect(parseStoredQuality(value)).toEqual(DEFAULTS);
    }
  });

  it("readStorage usa a validação em vez de confiar no JSON", () => {
    store[STORAGE_KEY] = JSON.stringify({ resolution: "1080p", economyMode: "sim" });
    expect(readStorage()).toEqual(DEFAULTS);
  });

  it("readStorage cai no default com JSON corrompido", () => {
    store[STORAGE_KEY] = "{ não é json";
    expect(readStorage()).toEqual(DEFAULTS);
  });
});

describe("detectLowEndDevice (CA-3.3)", () => {
  it("returns true when hardwareConcurrency <= 2", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 2 });
    expect(detectLowEndDevice()).toBe(true);
  });

  it("returns true when deviceMemory < 4", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 8, deviceMemory: 2 });
    expect(detectLowEndDevice()).toBe(true);
  });

  it("returns false when hardwareConcurrency=4 and deviceMemory=8", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 4, deviceMemory: 8 });
    expect(detectLowEndDevice()).toBe(false);
  });

  it("returns false when deviceMemory is absent and cores are high", () => {
    vi.stubGlobal("navigator", { hardwareConcurrency: 8 });
    expect(detectLowEndDevice()).toBe(false);
  });

  it("returns false when navigator is undefined (SSR)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectLowEndDevice()).toBe(false);
  });
});

describe("detectSafari (CA-4.1–4.5)", () => {
  it("returns true for Safari user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    });
    expect(detectSafari()).toBe(true);
  });

  it("returns false for Chrome user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    expect(detectSafari()).toBe(false);
  });

  it("returns false for Firefox user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    });
    expect(detectSafari()).toBe(false);
  });

  it("returns false when navigator is undefined (SSR)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectSafari()).toBe(false);
  });
});

// Antes estes dois blocos só chamavam saveStoredQuality e liam de volta — ou
// seja, testavam o próprio teste. O hook e o listener de `storage` nunca eram
// exercitados.
describe("dismissSuggestion (CA-4.3)", () => {
  it("persiste a dispensa e reflete na leitura do hook", () => {
    const { result } = renderHook(() => useVideoQuality());
    expect(result.current.hasSeenSuggestion).toBe(false);

    act(() => {
      result.current.dismissSuggestion();
    });

    expect(result.current.hasSeenSuggestion).toBe(true);
    expect(readStorage().economySuggestionDismissed).toBe(true);
  });
});

describe("cross-tab sync (CA-4.5)", () => {
  it("reage a mudança feita em outra aba (evento storage)", () => {
    const { result } = renderHook(() => useVideoQuality());
    expect(result.current.resolution).toBe("720p");

    act(() => {
      saveStoredQuality({ ...DEFAULTS, resolution: "480p" });
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(result.current.resolution).toBe("480p");
  });
});

describe("hook — estado inicial, hidratação e setters", () => {
  it("o snapshot do servidor é sempre o default (contrato de hidratação)", () => {
    // É este valor que o servidor renderiza e que o React usa no primeiro
    // render do cliente. Só depois de hidratar ele troca pelo snapshot real —
    // é isso que impede o hydration mismatch de quem já mexeu nas preferências.
    saveStoredQuality({ ...DEFAULTS, resolution: "480p", economyMode: true });
    expect(getServerSnapshot()).toEqual(DEFAULTS);
  });

  it("no cliente, já expõe o valor salvo", () => {
    saveStoredQuality({ ...DEFAULTS, resolution: "480p" });
    const { result } = renderHook(() => useVideoQuality());
    expect(result.current.resolution).toBe("480p");
  });

  it("setResolution e setFpsLimit persistem", () => {
    const { result } = renderHook(() => useVideoQuality());

    act(() => {
      result.current.setResolution("480p");
      result.current.setFpsLimit("30");
    });

    expect(result.current.resolution).toBe("480p");
    expect(result.current.fpsLimit).toBe("30");
    expect(readStorage()).toMatchObject({ resolution: "480p", fpsLimit: "30" });
  });

  it("setEconomyMode persiste", () => {
    const { result } = renderHook(() => useVideoQuality());

    act(() => {
      result.current.setEconomyMode(true);
    });

    expect(result.current.economyMode).toBe(true);
    expect(readStorage().economyMode).toBe(true);
  });

  it("setters preservam os outros campos", () => {
    const { result } = renderHook(() => useVideoQuality());

    act(() => {
      result.current.setEconomyMode(true);
      result.current.setResolution("480p");
    });

    expect(readStorage()).toMatchObject({
      economyMode: true,
      resolution: "480p",
      fpsLimit: "auto",
    });
  });
});
