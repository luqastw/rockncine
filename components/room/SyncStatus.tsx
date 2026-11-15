"use client";

import { useEffect, useState } from "react";
import type { PlayerEvent } from "@/liveblocks.config";
import { Staff } from "@/components/chrome/Staff";

const LIT_MS = 380;

export function SyncStatus({
  isPlaying,
  isBroadcasting,
  syncLimited,
  lastEvent,
  connectionLabel,
}: {
  isPlaying: boolean;
  isBroadcasting: boolean;
  syncLimited: boolean;
  lastEvent: PlayerEvent | null;
  connectionLabel?: string;
}) {
  const [spent, setSpent] = useState<PlayerEvent | null>(null);
  const lit = lastEvent !== null && spent !== lastEvent;

  useEffect(() => {
    if (!lastEvent) return;
    const timer = setTimeout(() => setSpent(lastEvent), LIT_MS);
    return () => clearTimeout(timer);
  }, [lastEvent]);

  const label = resolveLabel({ isPlaying, isBroadcasting, syncLimited, connectionLabel });
  if (!label) return null;

  const showDot = !connectionLabel && !isBroadcasting && isPlaying;

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 font-mono text-caption text-[var(--ink-muted)]"
    >
      <Staff notes={3} lit={lit} className="h-4 w-12" />
      {showDot && (
        <span
          aria-hidden
          data-sync-dot=""
          className="size-2 rounded-full bg-[var(--fairy)]"
        />
      )}
      <span className={showDot ? "text-[var(--ink)]" : undefined}>{label}</span>
    </span>
  );
}

function resolveLabel({
  isPlaying,
  isBroadcasting,
  syncLimited,
  connectionLabel,
}: {
  isPlaying: boolean;
  isBroadcasting: boolean;
  syncLimited: boolean;
  connectionLabel?: string;
}) {
  if (connectionLabel) return connectionLabel;
  if (isBroadcasting) return "transmissão";
  if (syncLimited) return null;
  return isPlaying ? "ao vivo" : "pausado";
}
