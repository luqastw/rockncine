import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectedPlaybackTime, STALE_SNAPSHOT_MS } from "./playerController";

const NOW = new Date("2026-01-01T00:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("expectedPlaybackTime", () => {
  it("avança currentTime pelo tempo decorrido quando isPlaying", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      120,
    );
    expect(result.time).toBeCloseTo(15, 1);
    expect(result.shouldPlay).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("não avança quando pausado", () => {
    const result = expectedPlaybackTime(
      { isPlaying: false, currentTime: 42, updatedAt: NOW - 60000 },
      120,
    );
    expect(result.time).toBe(42);
    expect(result.shouldPlay).toBe(false);
  });

  it("clampa no fim do vídeo em vez de ultrapassar a duração (achado 10)", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 100, updatedAt: NOW - 60_000 },
      120,
    );
    expect(result.time).toBe(119.5);
  });

  it("marca stale e não avança snapshot abandonado além do limiar (achado 10)", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - (STALE_SNAPSHOT_MS + 1000) },
      3600,
    );
    expect(result.stale).toBe(true);
    expect(result.shouldPlay).toBe(false);
    expect(result.time).toBe(10);
  });

  it("nunca retorna tempo negativo", () => {
    const result = expectedPlaybackTime(
      { isPlaying: false, currentTime: -5, updatedAt: NOW },
      120,
    );
    expect(result.time).toBe(0);
  });

  it("sem duração conhecida (0), não aplica teto", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      0,
    );
    expect(result.time).toBeCloseTo(15, 1);
  });
});
