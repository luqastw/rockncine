"use client";

import { useMyPresence, useOthers } from "@liveblocks/react";

export function PresenceList({ myName }: { myName: string }) {
  const others = useOthers();
  const [myPresence] = useMyPresence();

  return (
    <ul className="flex flex-col gap-2">
      <li className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]">
        <span className="h-2 w-2 rounded-full bg-[var(--ember)]" aria-hidden />
        {myPresence.name || myName}
        <span className="text-xs text-[var(--ink-muted)]">(você)</span>
        {myPresence.isMuted && <span aria-label="mutado">🔇</span>}
      </li>
      {others.map((other) => (
        <li
          key={other.connectionId}
          className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)]"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--ember)]" aria-hidden />
          {other.presence.name}
          {other.presence.isMuted && <span aria-label="mutado">🔇</span>}
        </li>
      ))}
    </ul>
  );
}
