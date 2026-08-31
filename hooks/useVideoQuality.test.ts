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

vi.stubGlobal("window", {});

const {
  detectLowEndDevice,
  detectSafari,
  readStorage,
  saveStoredQuality,
} = await import("./useVideoQuality");

describe("default state (CA-1.8)", () => {
  it("returns defaults when localStorage is empty", () => {
    const state = readStorage();
    expect(state).toEqual({
      resolution: "720p",
      fpsLimit: "auto",
      economyMode: false,
      economySuggestionDismissed: false,
    });
  });
});

describe("persistence (CA-2.4)", () => {
  it("writes resolution to localStorage and reads it back", () => {
    saveStoredQuality({
      resolution: "480p",
      fpsLimit: "auto",
      economyMode: false,
      economySuggestionDismissed: false,
    });
    expect(readStorage().resolution).toBe("480p");
  });

  it("writes fpsLimit to localStorage and reads it back", () => {
    saveStoredQuality({
      resolution: "720p",
      fpsLimit: "30",
      economyMode: false,
      economySuggestionDismissed: false,
    });
    expect(readStorage().fpsLimit).toBe("30");
  });

  it("writes economyMode to localStorage and reads it back", () => {
    saveStoredQuality({
      resolution: "720p",
      fpsLimit: "auto",
      economyMode: true,
      economySuggestionDismissed: false,
    });
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

describe("dismissSuggestion (CA-4.3)", () => {
  it("sets economySuggestionDismissed to true in localStorage", () => {
    saveStoredQuality({
      resolution: "720p",
      fpsLimit: "auto",
      economyMode: false,
      economySuggestionDismissed: false,
    });

    saveStoredQuality({
      ...readStorage(),
      economySuggestionDismissed: true,
    });

    expect(readStorage().economySuggestionDismissed).toBe(true);
  });
});

describe("cross-tab sync (CA-4.5)", () => {
  it("readStorage picks up changes written by another 'tab'", () => {
    saveStoredQuality({
      resolution: "480p",
      fpsLimit: "30",
      economyMode: true,
      economySuggestionDismissed: true,
    });
    expect(readStorage()).toEqual({
      resolution: "480p",
      fpsLimit: "30",
      economyMode: true,
      economySuggestionDismissed: true,
    });
  });
});
