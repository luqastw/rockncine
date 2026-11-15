"use client";

import { useConnectionState } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import { useLiveKitAuth, useLiveKitFailure } from "@/components/room/LiveKitProvider";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
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
        <Badge role="status" variant="solid">
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
        className={buttonClass({ variant: "outline", size: "sm", className: "shrink-0" })}
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
