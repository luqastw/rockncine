"use client";

import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import { useLiveKitAuth, useLiveKitFailure } from "@/components/room/LiveKitProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useBroadcastSession } from "@/hooks/useBroadcastSession";
import { useIsClient } from "@/hooks/useIsClient";
import { broadcasterLabel, canStartBroadcast } from "@/lib/broadcast";
import { sfuBlockedReason, sfuLivekitReason } from "@/lib/sfu-status";

export function BroadcastControls({
  broadcast,
  userId,
  userName,
  videoSourceUrl,
}: {
  broadcast: BroadcastState | null;
  userId: string;
  userName: string;
  videoSourceUrl: string | null;
}) {
  const connection = useConnectionState();
  const auth = useLiveKitAuth();
  const failure = useLiveKitFailure();
  const mounted = useIsClient();

  const blockedReason = sfuBlockedReason(auth, connection);
  const livekitReason = sfuLivekitReason(failure, connection === ConnectionState.Connected);

  const { busy, error, isBroadcaster, start, stop } = useBroadcastSession({
    broadcast,
    userId,
    userName,
    videoSourceUrl,
    blockedReason,
  });

  if (!mounted) return null;
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    return null;
  }

  if (isBroadcaster) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge role="status" variant="solid" className="uppercase tracking-wide">
          transmitindo
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={stop}
          aria-label="parar transmissão"
          className="shrink-0"
        >
          <span className="sm:hidden">parar</span>
          <span className="hidden sm:inline">parar transmissão</span>
        </Button>
      </div>
    );
  }

  const otherBroadcaster =
    broadcast !== null && !canStartBroadcast(broadcast, userId) ? broadcast : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy || otherBroadcaster !== null || blockedReason !== null}
        aria-label={
          otherBroadcaster
            ? "já há alguém transmitindo"
            : blockedReason
              ? blockedReason
              : busy
                ? "abrindo o seletor de tela"
                : "transmitir tela"
        }
        aria-busy={busy || undefined}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--ink-muted)] px-3 py-2 text-body-sm text-[var(--ink)] transition-colors duration-150 hover:border-[var(--ink)] hover:bg-[var(--fill-1)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--ink-muted)]"
      >
        <span className="sm:hidden">transmitir</span>
        <span className="hidden sm:inline">transmitir tela</span>
      </button>
      {otherBroadcaster && (
        <span className="text-caption text-[var(--ink-muted)]">
          {broadcasterLabel(otherBroadcaster)} está transmitindo
        </span>
      )}
      {blockedReason && !otherBroadcaster && auth.status !== "disabled" && (
        <span role="status" aria-live="polite" className="text-caption text-[var(--ink-muted)]">
          {blockedReason}
          {livekitReason && ` — ${livekitReason}`}
        </span>
      )}
      {error && (
        <span role="status" aria-live="polite" className="text-caption text-[var(--ink-muted)]">
          {error}
        </span>
      )}
    </div>
  );
}
