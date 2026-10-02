// Validação de fronteira dos eventos de chat que chegam por broadcast.
//
// O mesmo raciocínio de `lib/playback/events.ts`, aplicado ao feed: o payload
// vem de outro cliente (qualquer membro da sala escreve no broadcast) e é
// renderizado direto no `Chat`. Sem validação, um `{ text: {...} }` derrubava
// o React inteiro ("Objects are not valid as a React child") e, como não havia
// `error.tsx` no segmento da sala, cada participante perdia a página — um
// cliente malicioso derrubava a sala para todos.
//
// Aqui não basta rejeitar o que quebra o React: um `text` de 10 MB ou um `ts`
// absurdo também são negação de serviço, então há teto de tamanho em todo
// campo que vira string na tela.

import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

export type ChatFeedItem = ChatEvent | SystemEvent;

// Acima disto a mensagem sai da tela de qualquer jeito — o feed corta em 30
// itens e o log rola. 500 caracteres é folgado para uma frase de chat e
// pequeno o bastante para não virar vetor de memória.
const MAX_TEXT_LENGTH = 500;
const MAX_NAME_LENGTH = 64;
const MAX_ID_LENGTH = 64;
const MAX_AUTHOR_ID_LENGTH = 128;

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isPlausibleTs(value: unknown, now: number): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  // Mesma banda usada para os eventos de player (ver `MAX_TS_DRIFT_MS`): um
  // `ts` absurdo faria a ordenação do feed jumping e o "expira em 6s" do
  // LastActionNote nunca casar.
  return Math.abs(value - now) <= MAX_TS_DRIFT_MS;
}

// Ver `lib/playback/events.ts` — banda de sanidade do relógio. Declarada aqui
// também porque os dois validadores precisam do mesmo número: divergir abriria
// uma porta em que o chat passa e o player não (ou o contrário).
export const MAX_TS_DRIFT_MS = 30 * 1000;

function parseBase(
  value: unknown,
  now: number,
): { id: string; text: string; ts: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (raw.type !== "CHAT_MESSAGE" && raw.type !== "SYSTEM_MESSAGE") return null;
  if (!isNonEmptyString(raw.id, MAX_ID_LENGTH)) return null;
  if (!isNonEmptyString(raw.text, MAX_TEXT_LENGTH)) return null;
  if (!isPlausibleTs(raw.ts, now)) return null;

  return { id: raw.id, text: raw.text, ts: raw.ts };
}

// `authorId`/`authorName` são strings que o React escapa, então não há injeção
// de HTML aqui — mas eles são lookup (`authorId === userId` decide o "(você)")
// e texto truncado. Um objeto no lugar estraga o `===` e o `.truncate`.
export function parseChatEvent(value: unknown, now: number = Date.now()): ChatFeedItem | null {
  const base = parseBase(value, now);
  if (!base) return null;
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  if (raw.type === "SYSTEM_MESSAGE") {
    return { type: "SYSTEM_MESSAGE", id: base.id, text: base.text, ts: base.ts };
  }

  if (!isNonEmptyString(raw.authorId, MAX_AUTHOR_ID_LENGTH)) return null;
  if (typeof raw.authorName !== "string" || raw.authorName.length > MAX_NAME_LENGTH) return null;

  return {
    type: "CHAT_MESSAGE",
    id: base.id,
    authorId: raw.authorId,
    authorName: raw.authorName,
    text: base.text,
    ts: base.ts,
  };
}

export { MAX_TEXT_LENGTH };
