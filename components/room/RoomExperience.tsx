"use client";

import { useState } from "react";
import { useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { SyncRing } from "@/components/room/SyncRing";
import { PresenceList } from "@/components/room/PresenceList";
import { LoadVideoForm } from "@/components/room/LoadVideoForm";
import type { RoomEvent } from "@/liveblocks.config";

const YT_CONTAINER_ID = "yt-player";

export function RoomExperience({
  roomCode,
  userId,
  userName,
}: {
  roomCode: string;
  userId: string;
  userName: string;
}) {
  const video = useStorage((root) => root.video);
  const player = useStorage((root) => root.player);
  const [lastEvent, setLastEvent] = useState<RoomEvent | null>(null);

  useYouTubeSync({
    containerId: YT_CONTAINER_ID,
    userId,
    onRemoteEvent: setLastEvent,
  });

  const hasVideo = video?.source === "YOUTUBE" && !!video.embedUrl;

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h1 className="font-mono text-sm text-[var(--ink-muted)]">sala {roomCode}</h1>
          {player && (
            <span className="font-mono text-xs text-[var(--ink-muted)]">
              {player.isPlaying ? "● ao vivo · sincronizado" : "○ pausado"}
            </span>
          )}
        </header>

        <SyncRing
          isPlaying={player?.isPlaying ?? false}
          source={video?.source ?? null}
          lastEvent={lastEvent}
        >
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            {hasVideo ? (
              <div id={YT_CONTAINER_ID} className="h-full w-full" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[var(--ink-muted)]">
                cole um link do YouTube abaixo pra começar
              </div>
            )}
          </div>
        </SyncRing>

        <LoadVideoForm roomCode={roomCode} userId={userId} />
      </div>

      <aside className="flex w-full flex-col gap-6 lg:w-72">
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            presença
          </h2>
          <PresenceList myName={userName} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            chat
          </h2>
          <p className="text-sm text-[var(--ink-muted)]">chat entra na fase 3.</p>
        </section>
      </aside>
    </main>
  );
}
