import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectedPlaybackTime,
  STALE_SNAPSHOT_MS,
  DRIFT_THRESHOLD_NATIVE_S,
  DRIFT_THRESHOLD_YOUTUBE_S,
  CHECK_INTERVAL_MS,
  SEEK_WHILE_PAUSED_THRESHOLD_S,
  REMOTE_APPLY_COOLDOWN_MS,
} from "./playerController";

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

  it("não marca stale exatamente no limiar", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - STALE_SNAPSHOT_MS },
      3600,
    );
    expect(result.stale).toBe(false);
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

// O `updatedAt` do snapshot foi gravado com o relógio de QUEM agiu, e
// `Date.now()` aqui é o relógio local. Sem descontar a diferença, o seguidor
// ficava permanentemente fora da sala por esse valor (lib/playback/clock.ts).
describe("expectedPlaybackTime — compensação de desvio de relógio", () => {
  it("sem amostra (skewMs = 0), mantém o comportamento anterior", () => {
    const semSkew = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      120,
    );
    const explicito = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      120,
      0,
    );
    expect(explicito.time).toBe(semSkew.time);
  });

  it("desconta o desvio: relógio adiantado não infla o tempo decorrido", () => {
    // O ator está com o relógio 2s ADIANTADO. Ele gravou `updatedAt` às
    // NOW-5000 do relógio dele, que é NOW-7000 no nosso: decorreram 7s.
    const adiantado = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      120,
      2000,
    );
    expect(adiantado.time).toBeCloseTo(17, 1);
  });

  it("desconta o desvio: relógio atrasado não encolhe o tempo decorrido", () => {
    // Ator 3s ATRASADO: o instante que ele gravou como NOW-5000 é NOW-2000
    // no nosso relógio, então decorreram 2s.
    const atrasado = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      120,
      -3000,
    );
    expect(atrasado.time).toBeCloseTo(12, 1);
  });

  it("o teto de duração continua valendo com skew grande", () => {
    const result = expectedPlaybackTime(
      { isPlaying: true, currentTime: 10, updatedAt: NOW - 5000 },
      60,
      60_000,
    );
    expect(result.time).toBe(59.5);
  });
});

describe("constantes de sincronização (spec 08)", () => {
  // Asserção de RELAÇÃO, não de literal: fixar o valor exato só quebra quando
  // alguém mexe no fonte de propósito, sem indicar regressão nenhuma.
  it("a tolerância do YouTube é pelo menos o dobro da do player nativo", () => {
    expect(DRIFT_THRESHOLD_YOUTUBE_S).toBeGreaterThanOrEqual(DRIFT_THRESHOLD_NATIVE_S * 2);
  });

  it("as tolerâncias ficam na casa de segundos (pega erro de unidade)", () => {
    for (const threshold of [DRIFT_THRESHOLD_NATIVE_S, DRIFT_THRESHOLD_YOUTUBE_S]) {
      expect(threshold).toBeGreaterThan(0.5);
      expect(threshold).toBeLessThan(10);
    }
  });

  it("o cooldown do apply remoto expira antes da próxima checagem de drift", () => {
    // Se o cooldown fosse MAIOR que o intervalo de checagem, a guarda ainda
    // estaria ativa na checagem seguinte e a correção automática seria pulada
    // a cada duas rodadas.
    expect(REMOTE_APPLY_COOLDOWN_MS).toBeLessThan(CHECK_INTERVAL_MS);
  });

  it("o limiar de seek-enquanto-pausado fica na casa de segundos (pega erro de unidade)", () => {
    expect(SEEK_WHILE_PAUSED_THRESHOLD_S).toBeGreaterThan(0.5);
    expect(SEEK_WHILE_PAUSED_THRESHOLD_S).toBeLessThan(10);
  });
});
