import { describe, expect, it } from "vitest";
import { isVideoSourceKind, parsePlayerEvent, shouldApplyPlayerEvent } from "./events";
import type { PlayerEvent } from "@/liveblocks.config";

const validEvent: PlayerEvent = {
  type: "SEEK",
  time: 42,
  source: "YOUTUBE",
  actorId: "user-a",
  ts: 1000,
};

describe("parsePlayerEvent", () => {
  it("aceita um evento completo e válido", () => {
    expect(parsePlayerEvent(validEvent)).toEqual(validEvent);
  });

  it("aceita os três tipos de evento de player", () => {
    for (const type of ["PLAY", "PAUSE", "SEEK"] as const) {
      expect(parsePlayerEvent({ ...validEvent, type })?.type).toBe(type);
    }
  });

  it("rejeita payload que não é objeto", () => {
    for (const value of [null, undefined, "SEEK", 42, true, []]) {
      expect(parsePlayerEvent(value)).toBeNull();
    }
  });

  it("rejeita tipo de evento desconhecido", () => {
    expect(parsePlayerEvent({ ...validEvent, type: "LOAD_VIDEO" })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, type: "CHAT_MESSAGE" })).toBeNull();
  });

  // O payload vem de outro cliente e vira `currentTime`/`seekTo` direto.
  it("rejeita time não finito (NaN/Infinity), negativo ou absurdo", () => {
    expect(parsePlayerEvent({ ...validEvent, time: Number.NaN })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, time: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, time: -1 })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, time: 13 * 60 * 60 })).toBeNull();
  });

  it("rejeita ts não finito", () => {
    expect(parsePlayerEvent({ ...validEvent, ts: Number.NaN })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, ts: "1000" })).toBeNull();
  });

  it("rejeita actorId ausente ou vazio", () => {
    expect(parsePlayerEvent({ ...validEvent, actorId: "" })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, actorId: 7 })).toBeNull();
  });

  it("rejeita source ausente ou desconhecida", () => {
    expect(parsePlayerEvent({ ...validEvent, source: undefined })).toBeNull();
    expect(parsePlayerEvent({ ...validEvent, source: "TWITCH" })).toBeNull();
  });

  it("aceita as quatro fontes conhecidas", () => {
    for (const source of ["YOUTUBE", "VIMEO", "DIRECT_MEDIA", "GENERIC_IFRAME"] as const) {
      expect(parsePlayerEvent({ ...validEvent, source })?.source).toBe(source);
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
