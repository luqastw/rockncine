"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import { REACTION_EMOJIS } from "@/liveblocks.config";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Chat({ userId, userName }: { userId: string; userName: string }) {
  const { messages, sendMessage } = useChat({ userId, userName });
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col gap-2">
      <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
        chat
      </h2>

      <ul
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
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

      <div className="flex flex-wrap gap-1">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              setDraft((prev) => prev + emoji);
              inputRef.current?.focus();
            }}
            aria-label={`inserir ${emoji} na mensagem`}
            className="flex h-11 w-11 items-center justify-center rounded-md text-base hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
          >
            {emoji}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          sendMessage(draft);
          setDraft("");
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="mensagem"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-md bg-[var(--invert-bg)] px-4 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
        >
          enviar
        </button>
      </form>
    </div>
  );
}
