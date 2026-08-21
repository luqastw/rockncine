"use client";

import { useState } from "react";
import { useMyPresence, useOthers } from "@liveblocks/react";
import { ChevronDownIcon } from "@/components/room/player/icons";

export function PresenceList({ myName }: { myName: string }) {
  const others = useOthers();
  const [myPresence] = useMyPresence();
  const [expanded, setExpanded] = useState(false);

  // `useOthers` lista por CONEXÃO: a mesma pessoa com duas abas abertas
  // aparecia duas vezes, sem nenhuma indicação de que era a mesma pessoa
  // (achado 26 da auditoria). Deduplica por userId e tira as outras conexões
  // do próprio usuário.
  const uniqueOthers = new Map<string, string>();
  for (const other of others) {
    const id = other.presence?.userId;
    if (!id || id === myPresence.userId) continue;
    uniqueOthers.set(id, other.presence.name);
  }

  const total = uniqueOthers.size + 1;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-controls="presence-list"
        className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        <span className="font-mono text-xs text-[var(--ink-muted)]">{total} na sala</span>
        <ChevronDownIcon
          className={`ml-auto h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded ? (
        <ul id="presence-list" className="flex max-h-[30dvh] flex-col gap-2 overflow-y-auto">
          <li className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]">
            <span className="h-2 w-2 rounded-full bg-[var(--ink)]" aria-hidden />
            <span className="min-w-0 truncate">{myPresence.name || myName}</span>
            <span className="text-xs text-[var(--ink-muted)]">(você)</span>
          </li>
          {[...uniqueOthers].map(([userId, name]) => (
            <li
              key={userId}
              className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]"
            >
              <span className="h-2 w-2 rounded-full bg-[var(--ink)]" aria-hidden />
              <span className="min-w-0 truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
