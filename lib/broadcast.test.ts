import { describe, expect, it } from "vitest";
import { MAX_TS_DRIFT_MS } from "@/lib/playback/events";
import {
  BROADCAST_MAX_AGE_MS,
  broadcasterLabel,
  canStartBroadcast,
  parseBroadcast,
} from "./broadcast";
import type { BroadcastState } from "@/liveblocks.config";

// O storage do Liveblocks é estado compartilhado alimentado por um cliente, e
// o valor lido pode ser qualquer coisa: uma sala aberta antes do campo existir
// devolve `undefined`, e um cliente malicioso escreve o que quiser. O fallback
// tem que ser o modo player (AC-009), nunca uma sala presa sem player.
const NOW = 1_700_000_000_000;

const valid: BroadcastState = {
  broadcasterId: "user-a",
  broadcasterName: "ana",
  startedAt: NOW - 5_000,
  heartbeatAt: NOW - 5_000,
};

const parse = (value: unknown) => parseBroadcast(value, NOW);

describe("parseBroadcast", () => {
  it("AC-009: estado completo e válido passa intacto", () => {
    expect(parse(valid)).toEqual(valid);
  });

  it("aceita startedAt exatamente agora", () => {
    expect(parse({ ...valid, startedAt: NOW })).not.toBeNull();
  });

  // `useStorage` devolve `undefined` para uma chave que a sala ainda não tem —
  // toda sala aberta antes deste campo existir passa por aqui no primeiro render.
  it("AC-009: null e undefined viram null (nenhuma transmissão)", () => {
    expect(parse(null)).toBeNull();
    expect(parse(undefined)).toBeNull();
  });

  it("rejeita o que não é objeto", () => {
    for (const value of ["ana", 42, true, [{ broadcasterId: "a" }]]) {
      expect(parse(value)).toBeNull();
    }
  });

  // O caso que a task chama pelo nome: objeto no lugar de string. O
  // `broadcasterName` vai direto pro texto da tela de todo mundo — o mesmo
  // vetor que derrubava o React da sala inteira com `text` de chat não-string
  // (docs/specs/11-fechamento-auditoria/spec.md, FR-001).
  it("AC-009: objeto no lugar de string é descartado", () => {
    expect(parse({ ...valid, broadcasterName: { first: "ana" } })).toBeNull();
    expect(parse({ ...valid, broadcasterId: { id: "user-a" } })).toBeNull();
    expect(parse({ ...valid, startedAt: { now: NOW } })).toBeNull();
  });

  it("rejeita id ausente, vazio ou acima do teto", () => {
    expect(parse({ ...valid, broadcasterId: undefined })).toBeNull();
    expect(parse({ ...valid, broadcasterId: "" })).toBeNull();
    expect(parse({ ...valid, broadcasterId: "u".repeat(129) })).toBeNull();
  });

  it("rejeita nome acima do teto, mas aceita nome vazio", () => {
    expect(parse({ ...valid, broadcasterName: "n".repeat(65) })).toBeNull();
    // Conta sem `name` gravado: a reserva é rótulo, não estado inválido.
    expect(parse({ ...valid, broadcasterName: "" })).not.toBeNull();
  });

  it("rejeita startedAt não finito", () => {
    expect(parse({ ...valid, startedAt: Number.NaN })).toBeNull();
    expect(parse({ ...valid, startedAt: Number.POSITIVE_INFINITY })).toBeNull();
  });

  // A janela é de SILÊNCIO do transmissor, não de duração da transmissão. O
  // `heartbeatAt` é que expira: um host que continua renovando transmite a noite
  // inteira sem cair. Este é o teste que impede a regressão que existia antes
  // desta distinção — com teto sobre `startedAt`, uma sessão de cinema de 2h
  // expirava aos 10 min e a sala voltava ao modo player no meio do filme.
  it("sessão longa NÃO expira enquanto o transmissor renova o heartbeat", () => {
    const tresHoras = 3 * 60 * 60 * 1000;
    const emBreve = NOW - 30_000;
    const parsed = parse({
      ...valid,
      startedAt: emBreve - tresHoras,
      heartbeatAt: emBreve,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.startedAt).toBe(emBreve - tresHoras);
  });

  // O outro lado da mesma moeda: um cliente que morre sem rodar `pagehide`
  // (crash, kill do SO, aba da transmissão morta junto com a compartilhada)
  // deixa o storage para trás. Passar esse estado adiante prende a sala em
  // "modo transmissão" sem ninguém transmitindo, e ninguém consegue iniciar.
  it("rejeita estado cujo heartbeat parou há mais que a janela", () => {
    expect(parse({ ...valid, heartbeatAt: NOW - BROADCAST_MAX_AGE_MS - 1 })).toBeNull();
    expect(parse({ ...valid, heartbeatAt: NOW - BROADCAST_MAX_AGE_MS })).not.toBeNull();
  });

  it("rejeita heartbeat não finito", () => {
    expect(parse({ ...valid, heartbeatAt: Number.NaN })).toBeNull();
    expect(parse({ ...valid, heartbeatAt: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it("rejeita estado sem heartbeat (campo ausente)", () => {
    // Sala aberta antes do campo existir devolve `undefined` aqui, e um cliente
    // que escreve a forma antiga não pode prender a sala em modo transmissão.
    const semHeartbeat: Record<string, unknown> = { ...valid };
    delete semHeartbeat.heartbeatAt;
    expect(parse(semHeartbeat)).toBeNull();
  });

  // Mesma banda dos eventos de broadcast: um `startedAt` no futuro passaria
  // pela validade de idade e empurraria a expiração para o fim do tempo. O
  // futuro é julgado pelo `startedAt` porque ele é escrito uma vez — renovar
  // `heartbeatAt` não pode virar uma forma deresetar a banda.
  it("rejeita startedAt no futuro além da banda de plausibilidade", () => {
    expect(parse({ ...valid, startedAt: NOW + MAX_TS_DRIFT_MS + 1 })).toBeNull();
    expect(parse({ ...valid, startedAt: NOW - MAX_TS_DRIFT_MS - 1 })).not.toBeNull();
  });

  it("rejeita heartbeat no futuro além da banda", () => {
    expect(parse({ ...valid, heartbeatAt: NOW + MAX_TS_DRIFT_MS + 1 })).toBeNull();
    expect(parse({ ...valid, heartbeatAt: NOW - MAX_TS_DRIFT_MS - 1 })).not.toBeNull();
  });

  it("descarta campos extras em vez de repassá-los à UI", () => {
    const parsed = parse({ ...valid, isPlaying: true, inject: "x" });
    expect(parsed).toEqual(valid);
  });
});

describe("canStartBroadcast", () => {
  it("libera quando não há ninguém transmitindo", () => {
    expect(canStartBroadcast(null, "user-a")).toBe(true);
  });

  it("bloqueia quem não é o transmissor (FR-009)", () => {
    expect(canStartBroadcast(valid, "user-b")).toBe(false);
  });

  // O dono continua autorizado: reconectar depois de queda de rede não pode
  // deixá-lo sem como retomar o que era dele.
  it("libera o próprio transmissor", () => {
    expect(canStartBroadcast(valid, "user-a")).toBe(true);
  });
});

describe("broadcasterLabel", () => {
  it("usa o nome quando existe", () => {
    expect(broadcasterLabel(valid)).toBe("ana");
  });

  it("cai pro id quando o nome veio vazio", () => {
    expect(broadcasterLabel({ ...valid, broadcasterName: "" })).toBe("membro user-a");
  });
});
