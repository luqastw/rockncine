"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMyPresence, useOthers, useStatus } from "@liveblocks/react";
import { useChat } from "@/hooks/useChat";
import { useChatFeed } from "@/hooks/useChatFeed";
import { IdentityChip } from "@/components/room/IdentityChip";
import { MAX_TEXT_LENGTH } from "@/lib/chat-event";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";
import type { ChatFeedItem } from "@/lib/chat-event";
import { REACTION_EMOJIS } from "@/liveblocks.config";

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

function timeLabel(ts: number): string {
  return timeFormatter.format(ts);
}

// distância do fim (px) dentro da qual a lista ainda conta como "colada no
// rodapé" — acima disso o usuário está lendo o histórico e não deve ser
// arrastado pra baixo a cada mensagem nova (achado 14 da auditoria).
const PIN_THRESHOLD_PX = 48;

// duas falas do mesmo autor viram um bloco só dentro desta janela (FR-012).
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// 4 linhas de texto (20px de line-height) + o padding do campo. Depois disso o
// campo rola por dentro em vez de continuar crescendo (FR-023).
const MAX_FIELD_PX = 96;

// o quanto a pessoa pode digitar em silêncio antes de o indicador de "digitando"
// cair (FR-029). Abaixo disso, a presence ficaria `true` para sempre se alguém
// largasse o campo no meio da frase.
const TYPING_IDLE_MS = 1200;

// a partir deste tanto do limite o contador aparece, para quem escreve uma frase
// longa saber onde está o fim (FR-025).
const COUNTER_FROM = Math.floor(MAX_TEXT_LENGTH * 0.8);

const STATUS_NOTICE: Record<string, string> = {
  initial: "conectando… a mensagem fica na fila até a sala abrir.",
  connecting: "conectando… a mensagem fica na fila até a sala abrir.",
  reconnecting: "reconectando… a mensagem fica na fila e sai assim que voltar.",
  disconnected: "sem conexão… a mensagem fica na fila e sai assim que voltar.",
};

function keyOf(date: Date): string {
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
  return `${weekdayFormatter.format(date)}, ${dayFormatter.format(date)}`;
}

/** "hoje" / "ontem" / data por extenso, a partir da chave do dia de hoje. */
function dayLabel(ts: number, todayKey: string): string {
  const key = dayKey(ts);
  if (key === todayKey) return "hoje";
  if (key === previousDayKey(todayKey)) return "ontem";
  return longDayLabel(ts);
}

/**
 * Rola o log até o fim.
 *
 * `behavior: "auto"` (instantâneo) quando quem manda é quem está vendo a própria
 * mensagem: uma animação de rolagem aqui torna o texto que acabou de ser escrito
 * chegar com atraso (FR-019). Com o movimento desligado — `prefers-reduced-motion`
 * ou modo economy, que zera transição globalmente em `app/globals.css` — também
 * instantâneo.
 */
function scrollLogToEnd(list: HTMLElement, behavior: ScrollBehavior) {
  const top = list.scrollHeight;
  if (typeof list.scrollTo === "function") {
    list.scrollTo({ top, behavior });
    return;
  }
  list.scrollTop = top; // jsdom e navegadores sem `scrollTo` no elemento
}

function motionAllowed(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains("reduce-motion")) return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

// ── itens ─────────────────────────────────────────────────────────────────────

// Todo item é memoizado (FR-010): com 30 itens no log, digitar uma letra
// reconciliava os 30 `<li>` por baixo sem que nenhum deles tivesse mudado.
const MessageItem = memo(function MessageItem({
  item,
  grouped,
  isSelf,
}: {
  item: ChatEvent;
  grouped: boolean;
  isSelf: boolean;
}) {
  const time = timeLabel(item.ts);
  return (
    // `data-self` é o gancho de teste da AC-013.
    //
    // A mensagem própria é destacada por ALINHAMENTO e por uma caixa mais
    // escura (`--bg-void` sobre o `--bg-surface` do log) com fio de borda — e
    // não por inversão. A versão desta spec que invertia para branco mediu
    // errado na tela real: com uma pessoa só na sala quase toda linha virava
    // bloco branco, e a sala escura passava a parecer clara. A inversão
    // (`--invert-bg`) fica reservada para o que é estado ativo e CTA — contador
    // de não lidas, "novas mensagens", "enviar" — que é como o projeto já a usa
    // (app/globals.css).
    <li
      data-self={isSelf ? "true" : undefined}
      className={`flex ${isSelf ? "justify-end" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}
    >
      <div
        className={
          isSelf
            ? "max-w-[85%] rounded-md border border-[var(--line)] bg-[var(--bg-void)] px-3 py-1.5"
            : "max-w-full"
        }
      >
        {grouped ? (
          // No item agrupado o cabeçalho não está visível (FR-012), então autor e
          // horário precisam continuar disponíveis para o leitor de tela
          // (FR-022, AC-017).
          <span className="sr-only">{`${item.authorName}, ${time}: `}</span>
        ) : (
          <span className="flex items-center gap-2">
            <IdentityChip name={item.authorName} userId={item.authorId} size="sm" />
            <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
              {item.authorName}
            </span>
            {isSelf && <span className="text-xs text-[var(--ink-muted)]">(você)</span>}
            <time
              dateTime={new Date(item.ts).toISOString()}
              className="ml-auto shrink-0 font-mono text-xs text-[var(--ink-muted)]"
            >
              {time}
            </time>
          </span>
        )}
        {/* `--ink` sobre `--bg-void`: 17:1 de contraste, e a caixa é a única
            diferença estrutural entre falar e falar (FR-017). */}
        <p className="break-words text-[15px] leading-relaxed text-[var(--ink)]">
          {item.text}
        </p>
      </div>
    </li>
  );
});

const SystemItem = memo(function SystemItem({ item }: { item: SystemEvent }) {
  return (
    <li className="my-1.5 flex items-center gap-2 text-xs italic text-[var(--ink-muted)]">
      <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
      <span className="min-w-0 text-center">
        <span className="sr-only">aviso da sala: </span>
        {item.text}
      </span>
      <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
    </li>
  );
});

/**
 * Divisória do log.
 *
 * `aria-hidden` de propósito: o log é região `aria-live` com
 * `aria-relevant="additions"`, então cada nó novo é anunciado. A divisória é
 * informação visual de posição — o que o leitor de tela precisa já está em cada
 * item (autor no cabeçalho, horário em `<time>`), e a mensagem que acabou de
 * chegar é anunciada de qualquer forma. Anunciar "hoje" ou "novas mensagens" em
 * cima disso é redundância que vira barulho. O que precisa ser lido — autor e
 * horário do item agrupado — está no texto acessível do próprio item (AC-017).
 */
function DividerLine({ label, strong }: { label: string; strong?: boolean }) {
  const line = strong ? "bg-[var(--ink-muted)]" : "bg-[var(--line)]";
  return (
    <li
      aria-hidden
      className={`my-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-[var(--ink-muted)] ${strong ? "font-medium" : ""}`}
    >
      <span className={`h-px flex-1 ${line}`} aria-hidden />
      <span className="shrink-0">{label}</span>
      <span className={`h-px flex-1 ${line}`} aria-hidden />
    </li>
  );
}

// O rótulo do dia ("hoje", "ontem", "sábado, 03/10") depende do AGORA, não do
// item: uma mensagem de ontem continua "ontem" amanhã. Por isso ele é resolvido
// no render do divisor e não dentro do `buildLog` memoizado — que recebe só o
// `ts` e fica puro em relação ao relógio (ver `buildLog`).
// `todayKey` é dependência explícita: memoizar só pelo `ts` congelaria o rótulo.
// "Ontem" é uma relação com o dia de hoje, e o dia de hoje muda (FR-014).
const DayDivider = memo(function DayDivider({ ts, todayKey }: { ts: number; todayKey: string }) {
  return <DividerLine label={dayLabel(ts, todayKey)} />;
});

const UnreadDivider = memo(function UnreadDivider() {
  return <DividerLine label="novas mensagens" strong />;
});

type LogEntry =
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
function buildLog(messages: ChatFeedItem[], unreadId: string | null, selfId: string): LogEntry[] {
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

function isEmojiOnly(text: string): boolean {
  const cleaned = text.replace(/[\s\uFE0F\u200D]/g, "");
  if (cleaned.length === 0 || cleaned.length > 12) return false;
  for (const char of cleaned) {
    const code = char.codePointAt(0) ?? 0;
    const emoji =
      (code >= 0x1f300 && code <= 0x1faff) ||
      (code >= 0x2600 && code <= 0x27bf) ||
      (code >= 0x1f000 && code <= 0x1f2ff) ||
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0x1f3fb && code <= 0x1f3ff);
    if (!emoji) return false;
  }
  return true;
}

/**
 * Botão de emoji com popover (FR-028 da onda 3 / `tasks.md` T-017).
 *
 * A fileira de seis emojis vivia em uma linha fixa de 44px acima do composer,
 * dentro de um painel de 272px. Em tela curta essa linha é o que empurra o
 * campo para fora da viewport — a medida que está no comentário do `aside`. Com
 * o popover, os emojis só existem enquanto alguém quer usá-los, e o painel
 * ganha 44px de log.
 *
 * Foco: abre levando o foco para o primeiro emoji, fecha com Escape devolvendo o
 * foco ao gatilho, e fecha em clique fora. Sem isso o popover vira um canto morto
 * para quem navega por teclado.
 */
function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector("button");
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (panelRef.current?.contains(target) || triggerRef.current?.contains(target))) return;
      close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="emoji"
        className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--ink-muted)] text-base text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        <EmojiIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label="emojis"
          // `bottom-full` acima do botão: o popover abre para dentro da área do
          // log, que é onde o olho já está, e nunca empurra o composer para
          // baixo.
          className="absolute right-0 bottom-full z-30 mb-2 flex gap-1 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-1"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                triggerRef.current?.focus();
              }}
              aria-label={`inserir ${emoji} na mensagem`}
              className="flex h-11 w-11 items-center justify-center rounded-md text-base hover:bg-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.8 1.1 2 1.7 3.5 1.7s2.7-.6 3.5-1.7" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}

// `memo`: as três props são strings, então um render da sala (presença mudou,
// play/pause, fullscreen) não precisa redesenhar o log. O que acorda o `<Chat>`
// é a store do feed, a própria digitação e a presence — que é exatamente o que
// muda dentro dele (FR-002, FR-010).
export const Chat = memo(function Chat({
  userId,
  userName,
  roomCode,
}: {
  userId: string;
  userName: string;
  // Só para a store saber de qual sala é o feed (FR-007). Não é usado para mais
  // nada aqui dentro.
  roomCode: string;
}) {
  const messages = useChatFeed(roomCode);
  const { sendMessage } = useChat({ userId, userName });
  const status = useStatus();
  const others = useOthers();
  const [, updateMyPresence] = useMyPresence();

  const [draft, setDraft] = useState("");
  const [hasNew, setHasNew] = useState(false);
  const [unreadId, setUnreadId] = useState<string | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // ref, não state: entra no efeito de mensagens sem virar dependência dele.
  const pinnedRef = useRef(true);
  // quem acabou de enviar não espera animação para ver a própria frase.
  const justSentRef = useRef(false);
  const prevIdsRef = useRef<string[]>([]);
  // o aviso de digitação é presence, não estado de sala: os outros clients é que
  // precisam saber (FR-029). A ref guarda o timer para cancelá-lo a cada tecla,
  // e o `typingRef` evita reescrever a presence quando ela já está `true` —
  // presença por tecla seria tráfego por tecla.
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O dia de hoje é lido do relógio no render, mas vira uma STRING que só muda
  // uma vez por dia — e é isso que o `DayDivider` memoizado compara. `Date.now()`
  // seria reprovado pela regra de pureza do React e o resultado em estado
  // custaria um `setState` dentro de efeito (também reprovado); `new Date()`
  // produz o mesmo valor durante o dia inteiro, então o memo do divisor
  // continua valendo. O custo é o do `Intl` em cache: um `Date` por render.
  const todayKey = keyOf(new Date());

  const entries = useMemo(
    () => buildLog(messages, unreadId, userId),
    [messages, unreadId, userId],
  );

  // quantas mensagens chegaram depois da primeira não lida (FR-015). É o que o
  // cabeçalho mostra quando o log não está colado no rodapé.
  const unreadCount = useMemo(() => {
    if (!unreadId) return 0;
    const index = messages.findIndex((m) => m.id === unreadId);
    return index === -1 ? 0 : messages.length - index;
  }, [messages, unreadId]);

  const markAsRead = useCallback(() => {
    pinnedRef.current = true;
    setHasNew(false);
    setUnreadId(null);
    setScrolledUp(false);
  }, []);

  // O botão promete "novas mensagens ↓": ele tem que ROLAR, não só limpar a
  // marca. Rola sem animação — quem clicou quer o fim na tela agora.
  const goToLatest = useCallback(() => {
    markAsRead();
    const list = listRef.current;
    if (list) scrollLogToEnd(list, "auto");
  }, [markAsRead]);

  useEffect(() => {
    const list = listRef.current;
    const previousIds = prevIdsRef.current;
    const nextIds = messages.map((message) => message.id);

    if (list && pinnedRef.current) {
      scrollLogToEnd(list, justSentRef.current ? "auto" : motionAllowed() ? "smooth" : "auto");
      justSentRef.current = false;
      markAsRead();
    } else if (!pinnedRef.current) {
      const arrived = nextIds.find((id) => !previousIds.includes(id));
      if (arrived) {
        setHasNew(true);
        // A divisória fica no PRIMEIRO item que chegou com o usuário longe do
        // rodapé. Se a mensagem atrasada (FR-004) entrar no meio do log, a
        // posição real é a do item, não a do fim.
        setUnreadId((current) => current ?? arrived);
      }
    }

    prevIdsRef.current = nextIds;
  }, [messages, markAsRead]);

  const marcarDigitando = useCallback(() => {
    if (!typingRef.current) {
      typingRef.current = true;
      updateMyPresence({ typing: true });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      typingRef.current = false;
      updateMyPresence({ typing: false });
    }, TYPING_IDLE_MS);
  }, [updateMyPresence]);

  const pararDeDigitar = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (!typingRef.current) return;
    typingRef.current = false;
    updateMyPresence({ typing: false });
  }, [updateMyPresence]);

  // timer pendente não sobrevive ao unmount: ele escreveria presence de um
  // componente que não existe mais.
  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    [],
  );

  const submit = useCallback(
    (text?: string) => {
      const value = (text ?? draft).trim();
      if (!value) return;
      justSentRef.current = true;
      pinnedRef.current = true;
      pararDeDigitar();
      sendMessage(value);
      setDraft("");
      setHasNew(false);
      setUnreadId(null);
      setScrolledUp(false);
    },
    [draft, sendMessage, pararDeDigitar],
  );

  // Emoji entra onde o cursor está (FR-027). Antes ele era concatenado no fim
  // do texto, o que jogava o emoji para depois da palavra que o usuário estava
  // escrevendo. E um campo que ficava só com o emoji manda na hora: é o gesto
  // que as pessoas esperam de um atalho de emoji em chat.
  const insertEmoji = useCallback(
    (emoji: string) => {
      const field = fieldRef.current;
      const current = draft;
      if (!field || field.selectionStart === null) {
        setDraft(current + emoji);
        return;
      }
      const start = field.selectionStart;
      const end = field.selectionEnd ?? start;
      const next = current.slice(0, start) + emoji + current.slice(end);
      setDraft(next);

      if (current.trim() === "" && isEmojiOnly(next)) {
        submit(next);
        return;
      }

      const caret = start + emoji.length;
      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(caret, caret);
      });
    },
    [draft, submit],
  );

  // O campo cresce até 4 linhas e para (FR-023). Medir `scrollHeight` exige
  // zerar a altura antes: com a altura travada, `scrollHeight` nunca passa da
  // altura que o campo já tinha.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    // `scrollHeight` é 0 sem layout (campo oculto, fonte ainda carregando) e
    // aplicar esse 0 fixava o campo achatado até a próxima tecla. Sem layout não
    // há altura a medir: o `auto` que está acima é a resposta certa, e o
    // `min-h-11` segura o alvo de toque.
    const measured = field.scrollHeight;
    if (measured <= 0) return;
    field.style.height = `${Math.min(measured, MAX_FIELD_PX)}px`;
  }, [draft]);

  // Quem está digitando agora, deduplicado por pessoa: `useOthers` lista por
  // conexão, e a mesma pessoa com duas abas não deve aparecer duas vezes aqui
  // (mesmo dedupe de `PresenceList.tsx`).
  const typingNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const other of others) {
      const id = other.presence?.userId;
      if (!id || id === userId || other.presence?.typing !== true) continue;
      names.set(id, other.presence?.name || "alguém");
    }
    return [...names.values()];
  }, [others, userId]);

  const draftLength = draft.length;
  const showCounter = draftLength >= COUNTER_FROM;
  const overLimit = draftLength > MAX_TEXT_LENGTH;
  const notice = status === "connected" ? null : (STATUS_NOTICE[status] ?? null);

  return (
    // `<lg` o próprio chat é o contêiner de rolagem: se a altura disponível
    // não couber o cabeçalho + log + emojis + composer, quem rola é o conjunto,
    // em vez de o composer ser empurrado para fora da caixa (achado 10 da
    // revisão de design). Nada muda quando sobra altura — sem overflow, sem
    // rolagem. Em `lg+` o chat recebe a altura cheia da coluna e a rolagem
    // continua sendo só a do log.
    <div className="flex h-full min-h-0 flex-col gap-3 max-lg:overflow-y-auto">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          chat
        </h2>
        {/* Contador de não lidas (FR-015). O botão flutuante continua existindo
            — ele resolve o "quero ir lá", o contador resolve o "quanto me
            escapou". */}
        {unreadCount > 0 && (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--invert-bg)] px-1.5 text-[10px] font-bold text-[var(--invert-fg)]"
            aria-label={`${unreadCount} mensagens não lidas`}
          >
            {unreadCount}
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ul
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          onScroll={() => {
            const list = listRef.current;
            if (!list) return;
            const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
            const atBottom = distance < PIN_THRESHOLD_PX;
            pinnedRef.current = atBottom;
            setScrolledUp(list.scrollTop > 8);
            if (atBottom) markAsRead();
          }}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-3"
        >
          {/* A barra de rolagem é escondida em toda a aplicação
              (app/globals.css), então "há conteúdo acima" não tem sinal. Esta
              sombra é esse sinal, e ela só aparece quando há mesmo (FR-016). */}
          {scrolledUp && (
            <span
              aria-hidden
              data-testid="chat-scroll-shadow"
              className="pointer-events-none absolute inset-x-0 top-0 h-4 rounded-t-md"
              style={{
                background:
                  "linear-gradient(to bottom, var(--bg-surface), rgb(20 20 20 / 0))",
              }}
            />
          )}
          {/* Indicador de digitação (FR-030), só enquanto alguém digita.
              `aria-live="off"` de propósito: o log é região `aria-live` com
              `aria-relevant="additions"`, e sem esta linha o leitor de tela
              anuncia "bruno está digitando" a cada tecla que o bruno dá — o log
              é a conversa, não o status de quem está com o dedo no teclado. Um
              descendente com `aria-live="off"` é a forma documentada de ficar
              fora das Dream Reader Notification. */}
          {typingNames.length > 0 && (
            <li
              aria-live="off"
              className="mb-1 flex items-center gap-2 text-xs text-[var(--ink-muted)]"
            >
              <span aria-hidden className="flex gap-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ink-muted)]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ink-muted)]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--ink-muted)]" />
              </span>
              {typingNames.join(", ")}
              {typingNames.length === 1 ? " está digitando…" : " estão digitando…"}
            </li>
          )}
          {messages.length === 0 && (
            <li className="text-sm text-[var(--ink-muted)]">nenhuma mensagem ainda.</li>
          )}
          {entries.map((entry) => {
            if (entry.kind === "day") {
              return <DayDivider key={entry.key} ts={entry.ts} todayKey={todayKey} />;
            }
            if (entry.kind === "unread") {
              return <UnreadDivider key={entry.key} />;
            }
            if (entry.kind === "system") {
              return <SystemItem key={entry.key} item={entry.item} />;
            }
            return (
              <MessageItem
                key={entry.key}
                item={entry.item}
                grouped={entry.grouped}
                isSelf={entry.isSelf}
              />
            );
          })}
        </ul>
        {hasNew && (
          <button
            type="button"
            onClick={goToLatest}
            className="absolute inset-x-3 bottom-3 min-h-11 rounded-md bg-[var(--invert-bg)] px-3 text-xs font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            novas mensagens ↓
          </button>
        )}
      </div>

      {/* O composer fica preso no rodapé do chat quando o conteúdo rola: o
          campo de mensagem é o único caminho de entrada na sala, então ele não
          pode depender de o usuário descobrir que há conteúdo abaixo (ainda
          mais com a barra de rolagem escondida, por decisão de design). Sem
          overflow, `sticky` não desloca nada — só age no caso apertado. O fundo
          opaco é para o conteúdo não passar por trás do campo durante a
          rolagem. */}
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-1 max-lg:sticky max-lg:bottom-0 max-lg:bg-[var(--bg-void)]"
      >
        {/* Envio em fila, e não descarte silencioso (FR-005/FR-006): o campo
            continua aceitando texto durante a reconexão porque a mensagem vai
            para a fila local de `useChat`, que despeja no `connected` — o que não
            existia antes desta spec. */}
        {notice && (
          <p role="status" className="font-mono text-[11px] text-[var(--ink-muted)]">
            {notice}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={fieldRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              marcarDigitando();
            }}
            onKeyDown={(event) => {
              // Enter envia, Shift+Enter quebra a linha (FR-024). `isComposing`
              // é o que impede o Enter de fechar o candidato de um IME e enviar
              // a mensagem pela metade.
              if (event.key !== "Enter" || event.shiftKey) return;
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit();
            }}
            onFocus={() => {
              // Teclado virtual no mobile (FR-028): o campo é o único caminho
              // de entrada da sala e ele nasce embaixo da dobra.
              const form = formRef.current;
              if (form && typeof form.scrollIntoView === "function") {
                form.scrollIntoView({ block: "nearest" });
              }
            }}
            rows={1}
            placeholder="mensagem"
            aria-label="mensagem para o chat da sala"
            autoComplete="off"
            className="max-h-24 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-base leading-5 text-[var(--ink)] placeholder:text-[var(--ink-muted)] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          />
          <EmojiButton onPick={insertEmoji} />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-md bg-[var(--invert-bg)] px-4 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            enviar
          </button>
        </div>
        {/* Nenhum corte mudo (FR-025): o teto de 500 caracteres é do validador de
            entrada, então quem escreve precisa enxergar onde ele está antes de
            a frase ser cortada no envio. */}
        {showCounter && (
          // Sem `role="status"`: o contador muda a cada tecla perto do limite, e
          // anunciar a própria contagem a cada tecla é barulho. O texto de corte é
          // o que importa, e esse é raro.
          <p
            className={`self-end font-mono text-[11px] ${
              overLimit ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
            }`}
          >
            {draftLength}/{MAX_TEXT_LENGTH}
            {overLimit ? " — vai ser cortada" : ""}
          </p>
        )}
      </form>
    </div>
  );
});