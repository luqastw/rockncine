// Validação de fronteira do estado de transmissão, que mora no storage do
// Liveblocks (FR-002, docs/specs/12-transmissao-screen-share/spec.md).
//
// Mesmo raciocínio de `lib/playback/events.ts` e `lib/chat-event.ts`: o storage
// é estado compartilhado, alimentado por um cliente, e o Liveblocks retransmite
// o valor sem inspecioná-lo. `broadcasterName` vira texto na tela de todo mundo
// e `broadcasterId` decide se o botão de iniciar fica habilitado, então um
// objeto no lugar de string quebra o React da sala inteira e um id forjado
// destrava a transmissão para quem não é o dono.
//
// O fallback é `null`, ou seja, modo player. Um estado ilegível não pode
// trancar a sala num player vazio (AC-009): o modo player é o estado em que a
// sala funciona sem transmissão, então é o único fallback seguro.

import { MAX_TS_DRIFT_MS } from "@/lib/playback/events";
import type { BroadcastState } from "@/liveblocks.config";

// `broadcasterName` é um nome de exibição, não um texto livre. 64 é o mesmo
// teto do validador de chat.
const MAX_NAME_LENGTH = 64;
// `broadcasterId` é um id de usuário do banco; a folga é para não cortar nada
// que o app já emite.
const MAX_ID_LENGTH = 128;

// De quanto em quanto o transmissor renova `heartbeatAt` enquanto publica.
export const BROADCAST_HEARTBEAT_MS = 60 * 1000;

// Depois disto **sem Renovação** o estado é tratado como ausente. É uma janela
// de silêncio do transmissor, NÃO um tempo máximo de transmissão.
//
// A distinção é o que separa "escape hatch" de "teto": como `startedAt` é
// gravado uma vez, um teto absoluto sobre ele matava toda sessão mais longa que
// a janela — e sessão longa é o caso de uso (uma sala de cinema dura 2h+). Aos
// 10 minutos o `parseBroadcast` devolvia `null` para todo mundo: o player
// voltava, o botão "parar transmissão" sumia, e o host ficava publicando uma
// track que ninguém renderiza, com a UI dele anunciando "iniciar transmissão"
// de novo.
//
// O que a janela cobre é o que ela sempre devia cobrir: o storage sobrevive a
// um cliente que morre sem limpar (o `pagehide` nem sempre roda — crash, kill
// do SO, aba do transmissor morta junto com a compartilhada). Com heartbeat, um
// host vivo nunca expira e um host morto expira em até `BROADCAST_MAX_AGE_MS`.
export const BROADCAST_MAX_AGE_MS = 3 * 60 * 1000;

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function parseBroadcast(
  value: unknown,
  now: number = Date.now(),
): BroadcastState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (!isBoundedString(raw.broadcasterId, MAX_ID_LENGTH)) return null;
  // O nome pode vir vazio (conta sem `name`): a UI mostra o id como reserva.
  if (typeof raw.broadcasterName !== "string" || raw.broadcasterName.length > MAX_NAME_LENGTH) {
    return null;
  }
  if (typeof raw.startedAt !== "number" || !Number.isFinite(raw.startedAt)) return null;
  if (typeof raw.heartbeatAt !== "number" || !Number.isFinite(raw.heartbeatAt)) return null;

  // O FUTURO é julgado pelo `startedAt`: ele é escrito uma vez e nunca muda, então
  // um `startedAt` no futuro não é ruído de heartbeat — é clock adiantado ou
  // estado forjado, e precisa da banda de plausibilidade. Julgar pelo heartbeat
  // deixaria um `startedAt` absurdo passar e a validade de idade passaria a
  // depender de um campo que o cliente renova sozinho.
  if (now - raw.startedAt < -MAX_TS_DRIFT_MS) return null;

  // A expiração é por SILÊNCIO: o transmissor renova `heartbeatAt` enquanto
  // publica, então um host transmitindo uma sessão de 2h nunca cai aqui.
  const sinceHeartbeat = now - raw.heartbeatAt;
  if (sinceHeartbeat > BROADCAST_MAX_AGE_MS) return null;
  if (sinceHeartbeat < -MAX_TS_DRIFT_MS) return null;

  return {
    broadcasterId: raw.broadcasterId,
    broadcasterName: raw.broadcasterName,
    startedAt: raw.startedAt,
    heartbeatAt: raw.heartbeatAt,
  };
}

// Só um transmissor por sala, e ninguém mais pode iniciar enquanto houver um
// (FR-009). O dono continua autorizado: reconectar depois de uma queda de rede
// não pode deixá-lo sem botão para retomar o que era dele.
export function canStartBroadcast(broadcast: BroadcastState | null, userId: string): boolean {
  return broadcast === null || broadcast.broadcasterId === userId;
}

// Rótulo de quem está transmitindo, com reserva pro caso de a conta não ter
// `name` gravado. O id do LiveKit é sempre o mesmo `userId`, então nunca volta
// vazio.
export function broadcasterLabel(broadcast: BroadcastState): string {
  return broadcast.broadcasterName || `membro ${broadcast.broadcasterId}`;
}
