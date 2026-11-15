"use client";

import { memo, useCallback, useMemo } from "react";
import { useStatus } from "@liveblocks/react";
import { useChat } from "@/hooks/useChat";
import { useChatFeed } from "@/hooks/useChatFeed";
import { useStickyScroll } from "@/hooks/useStickyScroll";
import { useTypingPresence } from "@/hooks/useTypingPresence";
import { ChatComposer } from "@/components/room/chat/ChatComposer";
import { DayDivider, MessageItem, SystemItem, UnreadDivider } from "@/components/room/chat/LogItems";
import { Badge } from "@/components/ui/Badge";
import { buildLog, keyOf } from "@/lib/chat-log";

// `memo`: as props são primitivas, então um render da sala (presença mudou,
// play/pause, fullscreen) não precisa redesenhar o log. O que acorda o `<Chat>`
// é a store do feed, a própria digitação e a presence — que é exatamente o que
// muda dentro dele (FR-002, FR-010).
export const Chat = memo(function Chat({
  userId,
  userName,
  avatarV,
  roomCode,
}: {
  userId: string;
  userName: string;
  avatarV?: number | null;
  // Só para a store saber de qual sala é o feed (FR-007). Não é usado para mais
  // nada aqui dentro.
  roomCode: string;
}) {
  const messages = useChatFeed(roomCode);
  const { sendMessage } = useChat({ userId, userName, avatarV });
  const status = useStatus();
  const { marcarDigitando, pararDeDigitar, typingNames } = useTypingPresence(userId);
  const { listRef, hasNew, unreadId, scrolledUp, goToLatest, onScroll, markSent, resetUnread } =
    useStickyScroll(messages, typingNames.length);

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

  const handleSend = useCallback(
    (value: string) => {
      markSent();
      pararDeDigitar();
      sendMessage(value);
      resetUnread();
    },
    [markSent, pararDeDigitar, sendMessage, resetUnread],
  );

  return (
    // `<lg` o próprio chat é o contêiner de rolagem: se a altura disponível
    // não couber o cabeçalho + log + emojis + composer, quem rola é o conjunto,
    // em vez de o composer ser empurrado para fora da caixa (achado 10 da
    // revisão de design). Nada muda quando sobra altura — sem overflow, sem
    // rolagem. Em `lg+` o chat recebe a altura cheia da coluna e a rolagem
    // continua sendo só a do log.
    <div className="flex h-full min-h-0 flex-col gap-3 max-lg:overflow-y-auto">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]">
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 pb-2 pt-3">
            <Badge
              variant="solid"
              className="h-5 min-w-5 justify-center px-1.5 text-micro font-bold"
              aria-label={`${unreadCount} mensagens não lidas`}
            >
              {unreadCount}
            </Badge>
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ul
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            onScroll={onScroll}
            className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3"
          >
          {/* A barra de rolagem é escondida em toda a aplicação
              (app/globals.css), então "há conteúdo acima" não tem sinal. Esta
              sombra é esse sinal, e ela só aparece quando há mesmo (FR-016). */}
          {scrolledUp && (
            <span
              aria-hidden
              data-testid="chat-scroll-shadow"
              className="pointer-events-none absolute inset-x-0 top-0 h-4"
              style={{
                background: "linear-gradient(to bottom, var(--bg-surface), transparent)",
              }}
            />
          )}
          <li aria-hidden className="mt-auto" />
          {messages.length === 0 && (
            <li className="text-body-sm text-[var(--ink-muted)]">silêncio por aqui. diga oi.</li>
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
          {/* Indicador de digitação (FR-030), só enquanto alguém digita.
              `aria-live="off"` de propósito: o log é região `aria-live` com
              `aria-relevant="additions"`, e sem esta linha o leitor de tela
              anuncia "bruno está digitando" a cada tecla que o bruno dá — o log
              é a conversa, não o status de quem está com o dedo no teclado. Um
              descendente com `aria-live="off"` é a forma documentada de ficar
              fora das notificações do leitor de tela. */}
          {typingNames.length > 0 && (
            <li
              aria-live="off"
              className="mt-1 flex items-center gap-2 text-caption text-[var(--ink-muted)]"
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
        </ul>
        {hasNew && (
          <button
            type="button"
            onClick={goToLatest}
            className="absolute inset-x-3 bottom-3 min-h-11 rounded-lg bg-[var(--invert-bg)] px-3 text-caption font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            novas mensagens ↓
          </button>
        )}
        </div>
      </div>

      <ChatComposer status={status} onSend={handleSend} onTyping={marcarDigitando} />
    </div>
  );
});
