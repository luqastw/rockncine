"use client";

import { useStatus, useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useVimeoSync } from "@/hooks/useVimeoSync";
import { useLastRoomEvent } from "@/hooks/useLastRoomEvent";
import { SyncRing } from "@/components/room/SyncRing";
import { PresenceList } from "@/components/room/PresenceList";
import { LoadVideoForm } from "@/components/room/LoadVideoForm";
import { GenericIframe } from "@/components/room/GenericIframe";
import { PlayerLoadStatus } from "@/components/room/PlayerLoadStatus";
import { Chat } from "@/components/room/Chat";

const YT_CONTAINER_ID = "yt-player";
const VIMEO_CONTAINER_ID = "vimeo-player";

const CONNECTION_LABEL: Partial<Record<ReturnType<typeof useStatus>, string>> = {
  initial: "conectando...",
  connecting: "conectando...",
  reconnecting: "reconectando...",
  disconnected: "desconectado — tentando religar...",
};

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
  const lastEvent = useLastRoomEvent();
  const status = useStatus();

  const { isReady: youtubeReady, error: youtubeError } = useYouTubeSync({
    containerId: YT_CONTAINER_ID,
    userId,
  });
  const { isReady: vimeoReady, error: vimeoError } = useVimeoSync({
    containerId: VIMEO_CONTAINER_ID,
    userId,
  });

  const hasYouTube = video?.source === "YOUTUBE" && !!video.embedUrl;
  const hasVimeo = video?.source === "VIMEO" && !!video.embedUrl;
  const hasGeneric = video?.source === "GENERIC_IFRAME" && !!video.embedUrl;
  const syncLimited = video?.source === "GENERIC_IFRAME";

  const playerLoading = (hasYouTube && !youtubeReady) || (hasVimeo && !vimeoReady);
  const playerError = hasYouTube ? youtubeError : hasVimeo ? vimeoError : null;
  const connectionLabel = CONNECTION_LABEL[status];

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h1 className="font-mono text-sm text-[var(--ink-muted)]">sala {roomCode}</h1>
          {connectionLabel ? (
            <span className="font-mono text-xs text-[var(--ink-muted)]">{connectionLabel}</span>
          ) : (
            player &&
            !syncLimited && (
              <span className="font-mono text-xs text-[var(--ink-muted)]">
                {player.isPlaying ? "● ao vivo · sincronizado" : "○ pausado"}
              </span>
            )
          )}
        </header>

        <SyncRing
          isPlaying={player?.isPlaying ?? false}
          source={video?.source ?? null}
          lastEvent={lastEvent}
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
            {hasYouTube ? (
              <div id={YT_CONTAINER_ID} className="h-full w-full" />
            ) : hasVimeo ? (
              <div id={VIMEO_CONTAINER_ID} className="h-full w-full" />
            ) : hasGeneric ? (
              <GenericIframe src={video.embedUrl!} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[var(--ink-muted)]">
                cole um link (YouTube, Vimeo, Google Drive ou outro) abaixo pra começar
              </div>
            )}
            <PlayerLoadStatus
              key={video?.embedUrl}
              loading={playerLoading}
              error={playerError}
              sourceUrl={video?.sourceUrl ?? null}
            />
          </div>
        </SyncRing>

        <LoadVideoForm roomCode={roomCode} userId={userId} />

        {hasGeneric && (
          <p className="text-xs text-[var(--ink-muted)]">
            se a prévia não aparecer, o site pode não permitir incorporação —{" "}
            <a
              href={video!.embedUrl!}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--ember)] hover:underline"
            >
              abrir em nova aba
            </a>
            .
          </p>
        )}
      </div>

      <aside className="flex w-full min-h-0 flex-col gap-6 lg:w-72">
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
            presença
          </h2>
          <PresenceList myName={userName} />
        </section>
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <Chat userId={userId} userName={userName} />
        </section>
      </aside>
    </main>
  );
}
