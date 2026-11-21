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
}: {
  broadcast: BroadcastState | null;
  userId: string;
  userName: string;
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
          Transmitindo
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={stop}
          aria-label="Parar transmissão"
          className="shrink-0"
        >
          <span className="sm:hidden">Parar</span>
          <span className="hidden sm:inline">Parar transmissão</span>
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
            ? "Já há alguém transmitindo"
            : blockedReason
              ? blockedReason
              : busy
                ? "Abrindo o seletor de tela"
                : "Transmitir tela"
        }
        aria-busy={busy || undefined}
        className={buttonClass({ variant: "pair", size: "sm", className: "shrink-0" })}
      >
        <span className="sm:hidden">Transmitir</span>
        <span className="hidden sm:inline">Transmitir tela</span>
      </button>
      {otherBroadcaster && (
        <span className="text-caption text-[var(--ink-muted)]">
          {broadcasterLabel(otherBroadcaster)} está transmitindo
        </span>
      )}
      {blockedReason && !otherBroadcaster && auth.status !== "disabled" && (
        <span
          role="status"
          aria-live="polite"
          title={livekitReason ? `${blockedReason} — ${livekitReason}` : blockedReason}
          className="min-w-0 max-w-full truncate text-caption text-[var(--ink-muted)] lg:max-w-[9rem] 2xl:max-w-[22rem]"
        >
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
