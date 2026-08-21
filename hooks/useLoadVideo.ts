"use client";

import { useBroadcastEvent, useMutation } from "@liveblocks/react";
import type { ResolvedVideo } from "@/lib/video-source";
import type { PlayerEvent } from "@/liveblocks.config";

export function useLoadVideo(roomCode: string, userId: string) {
  const broadcast = useBroadcastEvent();

  const commitVideo = useMutation(
    ({ storage }, video: ResolvedVideo) => {
      storage.update({
        video: { ...video, loadedAt: Date.now() },
        player: {
          isPlaying: false,
          currentTime: 0,
          updatedAt: Date.now(),
          lastActorId: userId,
        },
      });
    },
    [userId],
  );

  return async function loadVideo(url: string) {
    const res = await fetch("/api/resolve-embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "não foi possível carregar o link.");
    }

    const resolved: ResolvedVideo = await res.json();
    commitVideo(resolved);

    const evt: PlayerEvent = {
      type: "LOAD_VIDEO",
      source: resolved.source,
      embedUrl: resolved.embedUrl,
      sourceUrl: resolved.sourceUrl,
      actorId: userId,
      ts: Date.now(),
    };
    broadcast(evt);

    // persiste no Postgres pra reabrir a sala depois — best effort, não bloqueia a UI
    fetch(`/rooms/${roomCode}/video`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resolved),
    }).catch(() => {});
  };
}
