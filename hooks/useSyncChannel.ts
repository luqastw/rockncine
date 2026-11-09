import { useCallback, useRef } from "react";
import { useBroadcastEvent, useMutation } from "@liveblocks/react";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import type { VideoSourceKind } from "@/lib/video-source";

type LocalEventType = "PLAY" | "PAUSE" | "SEEK";

export function useSyncChannel({ userId, source }: { userId: string; source: VideoSourceKind }) {
  const broadcast = useBroadcastEvent();

  const commitPlayer = useMutation(({ storage }, player: RoomStorage["player"]) => {
    storage.update({ player });
  }, []);

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

  return { emitLocal, lastAppliedTsRef };
}
