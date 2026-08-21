"use client";

import type { ReactNode } from "react";
import type { RoomEvent } from "@/liveblocks.config";
import type { VideoSourceKind } from "@/lib/video-source";

export function SyncRing({
  isPlaying,
  source,
  lastEvent,
  children,
}: {
  isPlaying: boolean;
  source: VideoSourceKind | null;
  lastEvent: RoomEvent | null;
  children: ReactNode;
}) {
  const syncLimited = source === "GENERIC_IFRAME";
  // troca de key remonta o overlay a cada evento, reiniciando a animação CSS
  // de flash — sem precisar de useEffect+setState pra "ecoar" o broadcast.
  const flashKey = lastEvent ? `${lastEvent.type}-${lastEvent.ts}` : "idle";

  // sem cor pra diferenciar estado: idle é borda sólida --line, "ao vivo" é
  // borda sólida --outline-strong (branca) com pulso, sync-limitado é
  // tracejada — três estados, três tratamentos estruturais, zero matiz.
  return (
    <div
      className={[
        "relative rounded-lg border-2 transition-shadow duration-300",
        syncLimited
          ? "border-dashed border-[var(--line)]"
          : isPlaying
            ? "border-[var(--outline-strong)]"
            : "border-[var(--line)]",
        !syncLimited && isPlaying ? "animate-sync-pulse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      {!syncLimited && lastEvent && (
        <span
          key={flashKey}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg animate-sync-flash"
        />
      )}
      {syncLimited && (
        <span className="absolute right-2 top-2 rounded-full border border-[var(--line)] bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--ink-muted)]">
          sync limitado — controle manual
        </span>
      )}
    </div>
  );
}
