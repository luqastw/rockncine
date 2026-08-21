"use client";

import { useEffect, useRef, useState } from "react";
import { useMyPresence } from "@liveblocks/react";
import { useChat } from "@/hooks/useChat";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function Chat({ userId, userName }: { userId: string; userName: string }) {
  const { messages, sendMessage } = useChat({ userId, userName });
  const [myPresence, updateMyPresence] = useMyPresence();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          chat
        </h2>
        <button
          type="button"
          onClick={() => updateMyPresence({ isMuted: !myPresence.isMuted })}
          className="min-h-11 rounded-md border border-[var(--line)] px-3 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
          aria-pressed={myPresence.isMuted}
        >
          {myPresence.isMuted ? "mutado" : "mutar"}
        </button>
      </div>

      <ul
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-3"
      >
        {messages.length === 0 && (
          <li className="text-sm text-[var(--ink-muted)]">nenhuma mensagem ainda.</li>
        )}
        {messages.map((msg) => (
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
        ))}
      </ul>

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
