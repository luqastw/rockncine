import type { ChatEvent, SystemEvent } from "@/liveblocks.config";
import type { ChatFeedItem } from "@/lib/chat-event";

// ── formatação de tempo ───────────────────────────────────────────────────────
//
// Instâncias únicas, no carregamento do módulo (FR-009,
// docs/specs/13-chat-sala/spec.md). Antes, `formatTime` chamava
// `toLocaleTimeString` por item, por render: medido em 30 construções de
// formatação por tecla digitada com o log cheio, e 30 por mensagem recebida
// (docs/specs/13-chat-sala/research.md, seção 2). `toLocaleTimeString` sem
// `Intl` em cache é das coisas mais caras que se pode chamar dentro de render.
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

export function timeLabel(ts: number): string {
  return timeFormatter.format(ts);
}

// duas falas do mesmo autor viram um bloco só dentro desta janela (FR-012).
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function keyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayKey(ts: number): string {
  return keyOf(new Date(ts));
}

/** Dia anterior em forma de chave, por aritmética — sem `Date.now()` no render. */
function previousDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return keyOf(new Date(year, month - 1, day - 1));
}

function longDayLabel(ts: number): string {
  const date = new Date(ts);
  const texto = `${weekdayFormatter.format(date)}, ${dayFormatter.format(date)}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "hoje" / "ontem" / data por extenso, a partir da chave do dia de hoje. */
export function dayLabel(ts: number, todayKey: string): string {
  const key = dayKey(ts);
  if (key === todayKey) return "Hoje";
  if (key === previousDayKey(todayKey)) return "Ontem";
  return longDayLabel(ts);
}

export type LogEntry =
  | { kind: "day"; key: string; ts: number }
  | { kind: "unread"; key: string }
  | { kind: "system"; key: string; item: SystemEvent }
  | { kind: "message"; key: string; item: ChatEvent; grouped: boolean; isSelf: boolean };

/**
 * Transforma o feed em linhas de log: divisórias de dia e de não lidas, e o
 * agrupamento das falas do mesmo autor (FR-012 a FR-015).
 *
 * Não chama `Date.now()`: o resultado é memoizado e o relógio dentro dele faria
 * o memo devolver objeto novo a cada render. O divisor de dia resolve o rótulo
 * no seu próprio render — são um ou dois por log, e o custo é irrelevante ao
 * lado do que a memoização evita.
 */
export function buildLog(messages: ChatFeedItem[], unreadId: string | null, selfId: string): LogEntry[] {
  const entries: LogEntry[] = [];
  let prevDay: string | null = null;
  let prevAuthorId: string | null = null;
  let prevTs = 0;
  let unreadPending = unreadId !== null;

  for (const item of messages) {
    if (unreadPending && item.id === unreadId) {
      entries.push({ kind: "unread", key: `unread-${item.id}` });
      unreadPending = false;
    }

    const day = dayKey(item.ts);
    if (day !== prevDay) {
      entries.push({ kind: "day", key: `day-${day}`, ts: item.ts });
      prevDay = day;
      prevAuthorId = null; // dia novo não continua o bloco do dia anterior
    }

    if (item.type === "SYSTEM_MESSAGE") {
      entries.push({ kind: "system", key: item.id, item });
      // Uma mensagem de sistema interrompe o agrupamento (FR-013): quem entrou ou
      // saiu é um evento, não uma fala contínua.
      prevAuthorId = null;
      prevTs = 0;
      continue;
    }

    entries.push({
      kind: "message",
      key: item.id,
      item,
      grouped: prevAuthorId === item.authorId && item.ts - prevTs < GROUP_WINDOW_MS,
      isSelf: item.authorId === selfId,
    });
    prevAuthorId = item.authorId;
    prevTs = item.ts;
  }

  return entries;
}
