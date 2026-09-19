"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatFeedItem } from "@/hooks/useChat";
import { REACTION_EMOJIS } from "@/liveblocks.config";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// distância do fim (px) dentro da qual a lista ainda conta como "colada no
// rodapé" — acima disso o usuário está lendo o histórico e não deve ser
// arrastado pra baixo a cada mensagem nova (achado 14 da auditoria).
const PIN_THRESHOLD_PX = 48;

export function Chat({
  userId,
  messages,
  sendMessage,
}: {
  userId: string;
  messages: ChatFeedItem[];
  sendMessage: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [hasNew, setHasNew] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // ref, não state: entra no efeito de mensagens sem virar dependência dele.
  const pinnedRef = useRef(true);

  const scrollToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setHasNew(false);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
      setHasNew(false);
    } else {
      setHasNew(true);
    }
  }, [messages]);

  return (
    // `<lg` o próprio chat é o contêiner de rolagem: se a altura disponível
    // não couber o cabeçalho + log + emojis + composer, quem rola é o conjunto,
    // em vez de o composer ser empurrado para fora da caixa (achado 10 da
    // revisão de design). Nada muda quando sobra altura — sem overflow, sem
    // rolagem. Em `lg+` o chat recebe a altura cheia da coluna e a rolagem
    // continua sendo só a do log.
    <div className="flex h-full min-h-0 flex-col gap-3 max-lg:overflow-y-auto">
      <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
        chat
      </h2>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ul
          ref={listRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          onScroll={() => {
            const el = listRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_THRESHOLD_PX;
            pinnedRef.current = atBottom;
            if (atBottom) setHasNew(false);
          }}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-3"
        >
          {messages.length === 0 && (
            <li className="text-sm text-[var(--ink-muted)]">nenhuma mensagem ainda.</li>
          )}
          {messages.map((msg) =>
            msg.type === "SYSTEM_MESSAGE" ? (
              <li
                key={msg.id}
                className="text-center text-xs italic text-[var(--ink-muted)]"
              >
                {msg.text}
              </li>
            ) : (
              <li key={msg.id} className="text-sm text-[var(--ink)]">
                <span className="font-mono text-xs text-[var(--ink-muted)]">
                  {formatTime(msg.ts)}
                </span>{" "}
                <span className="font-medium">{msg.authorName}</span>{" "}
                <span className="text-[var(--ink-muted)]">
                  {msg.authorId === userId ? "(você)" : ""}
                </span>
                <p className="break-words">{msg.text}</p>
              </li>
            ),
          )}
        </ul>
        {hasNew && (
          <button
            type="button"
            onClick={scrollToLatest}
            className="absolute inset-x-3 bottom-3 min-h-11 rounded-md bg-[var(--invert-bg)] px-3 text-xs font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            novas mensagens ↓
          </button>
        )}
      </div>

      {/* Uma linha só, com rolagem horizontal quando não couber: com
          `flex-wrap` os 6 emojis quebravam para 2 linhas a 320px de largura
          (6x44 + gaps > 272 disponíveis), e as 44px extras empurravam o campo
          de mensagem para fora da viewport em tela curta — medido a 320x700 o
          `aside` estourava 9px e o composer caía sob o selo do Liveblocks.
          `shrink-0` nos botões para o alvo de 44px não encolher. */}
      <div className="flex flex-nowrap gap-1 overflow-x-auto">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              setDraft((prev) => prev + emoji);
              inputRef.current?.focus();
            }}
            aria-label={`inserir ${emoji} na mensagem`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-base hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* O composer fica preso no rodapé do chat quando o conteúdo rola: o
          campo de mensagem é o único caminho de entrada na sala, então ele não
          pode depender de o usuário descobrir que há conteúdo abaixo (ainda
          mais com a barra de rolagem escondida, por decisão de design). Sem
          overflow, `sticky` não desloca nada — só age no caso apertado. O fundo
          opaco é para o conteúdo não passar por trás do campo durante a
          rolagem. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMessage(draft);
          setDraft("");
          scrollToLatest();
        }}
        className="flex gap-2 max-lg:sticky max-lg:bottom-0 max-lg:bg-[var(--bg-void)]"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="mensagem"
          aria-label="mensagem para o chat da sala"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-md bg-[var(--invert-bg)] px-4 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          enviar
        </button>
      </form>
    </div>
  );
}
