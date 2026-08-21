"use client";

import { useMyPresence, useOthers } from "@liveblocks/react";

export function PresenceList({ myName }: { myName: string }) {
  const others = useOthers();
  const [myPresence] = useMyPresence();

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
    <ul className="flex flex-col gap-2">
      <li className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]">
        <span className="h-2 w-2 rounded-full bg-[var(--ink)]" aria-hidden />
        <span className="min-w-0 truncate">{myPresence.name || myName}</span>
        <span className="text-xs text-[var(--ink-muted)]">(você)</span>
        <span className="ml-auto shrink-0 font-mono text-xs text-[var(--ink-muted)]">
          {total} na sala
        </span>
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
  );
}
