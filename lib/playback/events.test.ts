import { describe, expect, it } from "vitest";
import {
  MAX_TS_DRIFT_MS,
  isVideoSourceKind,
  parsePlayerEvent,
  shouldApplyPlayerEvent,
} from "./events";
import type { PlayerEvent } from "@/liveblocks.config";

// `parsePlayerEvent` compara o `ts` com o relógio local, então os testes
// fixam `now` em vez de depender de `Date.now()`.
const NOW = 1_000_000;

const validEvent: PlayerEvent = {
  type: "SEEK",
  time: 42,
  source: "YOUTUBE",
  actorId: "user-a",
  ts: NOW,
};

const parse = (value: unknown) => parsePlayerEvent(value, NOW);

describe("parsePlayerEvent", () => {
  it("aceita um evento completo e válido", () => {
    expect(parse(validEvent)).toEqual(validEvent);
  });

  it("aceita os três tipos de evento de player", () => {
    for (const type of ["PLAY", "PAUSE", "SEEK"] as const) {
      expect(parse({ ...validEvent, type })?.type).toBe(type);
    }
  });

  it("rejeita payload que não é objeto", () => {
    for (const value of [null, undefined, "SEEK", 42, true, []]) {
      expect(parse(value)).toBeNull();
    }
  });

  it("rejeita tipo de evento desconhecido", () => {
    expect(parse({ ...validEvent, type: "LOAD_VIDEO" })).toBeNull();
    expect(parse({ ...validEvent, type: "CHAT_MESSAGE" })).toBeNull();
  });

  // O payload vem de outro cliente e vira `currentTime`/`seekTo` direto.
  it("rejeita time não finito (NaN/Infinity), negativo ou absurdo", () => {
    expect(parse({ ...validEvent, time: Number.NaN })).toBeNull();
    expect(parse({ ...validEvent, time: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parse({ ...validEvent, time: -1 })).toBeNull();
    expect(parse({ ...validEvent, time: 13 * 60 * 60 })).toBeNull();
  });

  it("rejeita ts não finito", () => {
    expect(parse({ ...validEvent, ts: Number.NaN })).toBeNull();
    expect(parse({ ...validEvent, ts: "1000" })).toBeNull();
  });

  // O congelamento de sala: `shouldApplyPlayerEvent` descarta o evento quando
  // `ts <= lastAppliedTs`. Um `ts` no futuro virava um `lastAppliedTs` no
  // futuro e todo play/pause/seek legítimo de qualquer participante era
  // descartado dali em diante — a sala não aceitava mais nenhum comando.
  it("rejeita ts no futuro além da banda de plausibilidade", () => {
    expect(parse({ ...validEvent, ts: NOW + 60_000 })).toBeNull();
    expect(parse({ ...validEvent, ts: NOW + MAX_TS_DRIFT_MS + 1 })).toBeNull();
    expect(parse({ ...validEvent, ts: 1e300 })).toBeNull();
    expect(parse({ ...validEvent, ts: Number.MAX_SAFE_INTEGER })).toBeNull();
  });

  it("rejeita ts no passado além da banda", () => {
    expect(parse({ ...validEvent, ts: NOW - 60_000 })).toBeNull();
    expect(parse({ ...validEvent, ts: 0 })).toBeNull();
  });

  it("aceita ts dentro da banda, inclusive um pouco no passado", () => {
    // Eventos legítimos chegam um pouco no passado: o `ts` foi gravado antes do
    // round-trip. Rejeitar isso quebraria a sala em latência normal.
    expect(parse({ ...validEvent, ts: NOW - 5_000 })?.ts).toBe(NOW - 5_000);
    expect(parse({ ...validEvent, ts: NOW + 5_000 })?.ts).toBe(NOW + 5_000);
    expect(parse({ ...validEvent, ts: NOW - MAX_TS_DRIFT_MS })?.ts).toBe(NOW - MAX_TS_DRIFT_MS);
  });

  it("rejeita actorId ausente ou vazio", () => {
    expect(parse({ ...validEvent, actorId: "" })).toBeNull();
    expect(parse({ ...validEvent, actorId: 7 })).toBeNull();
  });

  it("rejeita source ausente ou desconhecida", () => {
    expect(parse({ ...validEvent, source: undefined })).toBeNull();
    expect(parse({ ...validEvent, source: "TWITCH" })).toBeNull();
  });

  it("aceita as quatro fontes conhecidas", () => {
    for (const source of ["YOUTUBE", "VIMEO", "DIRECT_MEDIA", "GENERIC_IFRAME"] as const) {
      expect(parse({ ...validEvent, source })?.source).toBe(source);
    }
  });
});

describe("isVideoSourceKind", () => {
  it("reconhece as fontes do domínio", () => {
    expect(isVideoSourceKind("YOUTUBE")).toBe(true);
    expect(isVideoSourceKind("VIMEO")).toBe(true);
    expect(isVideoSourceKind("DIRECT_MEDIA")).toBe(true);
    expect(isVideoSourceKind("GENERIC_IFRAME")).toBe(true);
  });

  it("recusa qualquer outra coisa", () => {
    expect(isVideoSourceKind("youtube")).toBe(false);
    expect(isVideoSourceKind(null)).toBe(false);
    expect(isVideoSourceKind(1)).toBe(false);
  });
});

describe("shouldApplyPlayerEvent", () => {
  const ctx = { selfId: "user-me", localSource: "YOUTUBE" as const, lastAppliedTs: null };

  it("aplica evento de outro ator, da mesma fonte, sem histórico", () => {
    expect(shouldApplyPlayerEvent(validEvent, ctx)).toBe(true);
  });

  it("descarta o eco da própria origem", () => {
    expect(shouldApplyPlayerEvent({ ...validEvent, actorId: "user-me" }, ctx)).toBe(false);
  });

  // Sem `source` no evento, um PLAY emitido quando a sala estava no Vimeo era
  // aplicado no player do YouTube recém-carregado — buscando no conteúdo errado.
  it("descarta evento de outra fonte", () => {
    expect(shouldApplyPlayerEvent({ ...validEvent, source: "VIMEO" }, ctx)).toBe(false);
  });

  // O broadcast não garante ordem: um PAUSE antigo que chegasse depois de um
  // SEEK novo rebobinava a sala contra o snapshot mais recente do storage.
  it("descarta evento atrasado ou duplicado (last-write-wins por ts)", () => {
    const withHistory = { ...ctx, lastAppliedTs: 1000 };
    expect(shouldApplyPlayerEvent({ ...validEvent, ts: 999 }, withHistory)).toBe(false);
    expect(shouldApplyPlayerEvent({ ...validEvent, ts: 1000 }, withHistory)).toBe(false);
    expect(shouldApplyPlayerEvent({ ...validEvent, ts: 1001 }, withHistory)).toBe(true);
  });
});
