import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import type { VideoSourceKind } from "@/lib/video-source";
import { parsePlayerEvent, shouldApplyPlayerEvent } from "@/lib/playback/events";
import { skewFor, updateSkew, type SkewSamples } from "@/lib/playback/clock";
import { expectedPlaybackTime, CHECK_INTERVAL_MS } from "@/hooks/playerController";

type LocalEventType = "PLAY" | "PAUSE" | "SEEK";

export type SyncChannel = {
  userId: string;
  source: VideoSourceKind;
  emitLocal: (type: LocalEventType, time: number, isPlaying?: boolean) => void;
  lastAppliedTsRef: RefObject<number | null>;
  skewRef: RefObject<SkewSamples>;
  playerStorageRef: RefObject<RoomStorage["player"] | null | undefined>;
};

export function useSyncChannel({
  userId,
  source,
}: {
  userId: string;
  source: VideoSourceKind;
}): SyncChannel {
  const playerStorage = useStorage((root) => root.player);
  const playerStorageRef = useRef(playerStorage);
  useEffect(() => {
    playerStorageRef.current = playerStorage;
  }, [playerStorage]);

  const broadcast = useBroadcastEvent();

  const commitPlayer = useMutation(({ storage }, player: RoomStorage["player"]) => {
    storage.update({ player });
  }, []);

  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);

  const emitLocal = useCallback(
    (type: LocalEventType, time: number, isPlaying?: boolean) => {
      const evt: PlayerEvent = { type, time, source, actorId: userId, ts: Date.now() };
      lastAppliedTsRef.current = evt.ts;
      commitPlayer({
        isPlaying: isPlaying ?? type === "PLAY",
        currentTime: time,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    },
    [userId, source, commitPlayer, broadcast],
  );

  return { userId, source, emitLocal, lastAppliedTsRef, skewRef, playerStorageRef };
}

export function useRemotePlayerEvents(
  channel: SyncChannel,
  { isAttached, apply }: { isAttached: () => boolean; apply: (event: PlayerEvent) => void },
) {
  const { userId, source, lastAppliedTsRef, skewRef } = channel;
  useEventListener(({ event }) => {
    // O payload chega de outro cliente e vira posição de seek direto: passa
    // por validação de formato antes de qualquer coisa (lib/playback/events).
    const parsed = parsePlayerEvent(event);
    if (!parsed) return;

    // Alimenta a estimativa de desvio de relógio com o `ts` do remetente.
    skewRef.current = updateSkew(skewRef.current, parsed.actorId, parsed.ts, Date.now());

    if (!isAttached()) return;

    if (
      !shouldApplyPlayerEvent(parsed, {
        selfId: userId,
        localSource: source,
        lastAppliedTs: lastAppliedTsRef.current,
      })
    ) {
      return;
    }
    lastAppliedTsRef.current = parsed.ts;

    apply(parsed);
  });
}

type DriftOptions = {
  isReady: boolean;
  thresholdS: number;
  isApplyingRemoteRef: RefObject<boolean>;
  applyRemote: (fn: () => unknown) => void;
  readTime: () => number | Promise<number> | null;
  getDuration: () => number;
  seekTo: (expected: number) => unknown;
  onOwnerTick?: (localTime: number, diff: number) => void;
};

export function useDriftCheck(channel: SyncChannel, options: DriftOptions) {
  const { userId, skewRef, playerStorageRef } = channel;
  const { isReady, isApplyingRemoteRef, applyRemote } = options;
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      const opts = optionsRef.current;
      const snapshot = playerStorageRef.current;
      if (!snapshot || !isReady) return;
      if (isApplyingRemoteRef.current) return;
      const isOwner = snapshot.lastActorId === userId;
      if (isOwner && !opts.onOwnerTick) return;

      const reading = opts.readTime();
      if (reading === null) return;

      const evaluate = (localTime: number) => {
        const { time: expected, stale } = expectedPlaybackTime(
          snapshot,
          opts.getDuration(),
          skewFor(skewRef.current, snapshot.lastActorId),
        );
        if (stale) return; // snapshot abandonado: não arrasta ninguém (ver playerController)
        const diff = localTime - expected;
        if (isOwner) {
          opts.onOwnerTick?.(localTime, diff);
          return;
        }
        if (Math.abs(diff) > opts.thresholdS) {
          applyRemote(() => opts.seekTo(expected));
        }
      };

      if (typeof reading === "number") {
        evaluate(reading);
        return;
      }
      reading.then(evaluate);
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
    // `duration` sai das deps de propósito: com o estado do player na store
    // externa, este efeito não re-assina a cada tick — e `expectedPlaybackTime`
    // já é clampado pela duração que o próprio player fornece.
  }, [isReady, userId, applyRemote, isApplyingRemoteRef, playerStorageRef, skewRef]);
}
