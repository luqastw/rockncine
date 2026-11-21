"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@liveblocks/react";
import { useLocalParticipant, useMaybeRoomContext } from "@livekit/components-react";
import { RoomEvent, Track, type LocalTrackPublication } from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import { BROADCAST_HEARTBEAT_MS } from "@/lib/broadcast";
import { BROADCAST_QUALITY, broadcastPublishOptions } from "@/lib/broadcast-quality";
import { SCREEN_CAPTURE_OPTIONS, classifyPublishError } from "@/lib/screen-capture";

export function useBroadcastSession({
  broadcast,
  userId,
  userName,
  blockedReason,
}: {
  broadcast: BroadcastState | null;
  userId: string;
  userName: string;
  blockedReason: string | null;
}) {
  const room = useMaybeRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const isBroadcaster = broadcast !== null && broadcast.broadcasterId === userId;

  const startBroadcast = useMutation(
    ({ storage }) => {
      const now = Date.now();
      storage.set("broadcast", {
        broadcasterId: userId,
        broadcasterName: userName,
        startedAt: now,
        heartbeatAt: now,
      });
    },
    [userId, userName],
  );

  const heartbeat = useMutation(
    ({ storage }) => {
      const current = storage.get("broadcast");
      if (!current || current.broadcasterId !== userId) return;
      storage.set("broadcast", { ...current, heartbeatAt: Date.now() });
    },
    [userId],
  );

  const clearBroadcast = useMutation(
    ({ storage }) => {
      const current = storage.get("broadcast");
      if (current && current.broadcasterId !== userId) return;
      storage.set("broadcast", null);
    },
    [userId],
  );

  const stopScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch {}
  }, [localParticipant]);

  const stop = useCallback(() => {
    stopScreenShare();
    clearBroadcast();
  }, [stopScreenShare, clearBroadcast]);

  const start = useCallback(async () => {
    if (busyRef.current) return;
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      await localParticipant.setScreenShareEnabled(
        true,
        { ...SCREEN_CAPTURE_OPTIONS, resolution: BROADCAST_QUALITY.preset },
        broadcastPublishOptions(BROADCAST_QUALITY),
      );
      startBroadcast();
    } catch (caught: unknown) {
      const { kind, message } = classifyPublishError(caught);
      if (kind === "denied") {
        setError(message);
        return;
      }
      await stopScreenShare();
      console.error("[transmissão] falha ao publicar a track de tela", caught);
      setError(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [blockedReason, localParticipant, startBroadcast, stopScreenShare]);

  useEffect(() => {
    if (!room || !isBroadcaster) return;
    const onUnpublished = (publication: LocalTrackPublication) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      stopScreenShare();
      clearBroadcast();
    };
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room, isBroadcaster, stopScreenShare, clearBroadcast]);

  useEffect(() => {
    if (!isBroadcaster) return;
    const interval = window.setInterval(() => heartbeat(), BROADCAST_HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [isBroadcaster, heartbeat]);

  useEffect(() => {
    if (!isBroadcaster) return;
    const onHide = () => clearBroadcast();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      clearBroadcast();
    };
  }, [isBroadcaster, clearBroadcast]);

  return { busy, error, isBroadcaster, start, stop };
}
