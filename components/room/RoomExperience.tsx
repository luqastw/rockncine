"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStatus, useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useVimeoSync } from "@/hooks/useVimeoSync";
import { useNativeVideoSync } from "@/hooks/useNativeVideoSync";
import { useLastRoomEvent } from "@/hooks/useLastRoomEvent";
import { SyncRing } from "@/components/room/SyncRing";
import { PresenceList } from "@/components/room/PresenceList";
import { GenericIframe } from "@/components/room/GenericIframe";
import { NativeVideoPlayer } from "@/components/room/NativeVideoPlayer";
import { PlayerLoadStatus } from "@/components/room/PlayerLoadStatus";
import { PlayerShell } from "@/components/room/player/PlayerShell";
import { LoadVideoModal } from "@/components/room/player/LoadVideoModal";
import { PlayIcon, PlusIcon, TheaterIcon } from "@/components/room/player/icons";
import { Chat } from "@/components/room/Chat";

const YT_CONTAINER_ID = "yt-player";
const VIMEO_CONTAINER_ID = "vimeo-player";
const NATIVE_CONTAINER_ID = "native-player";

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
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsFullscreen(active);
      if (!active) setIsTheater(false); // não fica "grudado" ao reentrar depois
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stageRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const { isReady: youtubeReady, error: youtubeError, controller: youtubeController } =
    useYouTubeSync({ containerId: YT_CONTAINER_ID, userId });
  const { isReady: vimeoReady, error: vimeoError, controller: vimeoController } = useVimeoSync({
    containerId: VIMEO_CONTAINER_ID,
    userId,
  });
  const { isReady: nativeReady, error: nativeError, controller: nativeController } =
    useNativeVideoSync({ containerId: NATIVE_CONTAINER_ID, userId });

  const hasYouTube = video?.source === "YOUTUBE" && !!video.embedUrl;
  const hasVimeo = video?.source === "VIMEO" && !!video.embedUrl;
  const hasDirectMedia = video?.source === "DIRECT_MEDIA" && !!video.embedUrl;
  const hasGeneric = video?.source === "GENERIC_IFRAME" && !!video.embedUrl;
  const syncLimited = video?.source === "GENERIC_IFRAME";

  const playerLoading =
    (hasYouTube && !youtubeReady) || (hasVimeo && !vimeoReady) || (hasDirectMedia && !nativeReady);
  const playerError = hasYouTube
    ? youtubeError
    : hasVimeo
      ? vimeoError
      : hasDirectMedia
        ? nativeError
        : null;
  const activeController = hasYouTube
    ? youtubeController
    : hasVimeo
      ? vimeoController
      : hasDirectMedia
        ? nativeController
        : null;
  const connectionLabel = CONNECTION_LABEL[status];

  // YouTube não tem parâmetro oficial pra desligar a tela de sugestões que
  // desenha por cima ao pausar (ver SPEC.md seção 7) — cobrimos com um
  // overlay nosso, que também funciona como afford ncia extra de play.
  const showYoutubePauseOverlay = hasYouTube && youtubeController.isReady && !youtubeController.isPlaying;

  const showAside = !isFullscreen || isTheater;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1800px] flex-col gap-6 px-6 py-8">
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

      <div
        ref={stageRef}
        className="relative flex flex-1 flex-col gap-6 bg-[var(--bg-void)] lg:flex-row"
      >
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsTheater((v) => !v)}
            aria-label={isTheater ? "expandir vídeo" : "abrir chat ao lado"}
            aria-pressed={isTheater}
            className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90 text-[var(--ink)] backdrop-blur-sm hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
          >
            <TheaterIcon className="h-4 w-4" />
          </button>
        )}

        <div className={`flex flex-col gap-4 ${showAside ? "lg:basis-[80%]" : "w-full"}`}>
          <SyncRing
            isPlaying={player?.isPlaying ?? false}
            source={video?.source ?? null}
            lastEvent={lastEvent}
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
              <PlayerShell
                controller={activeController}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
              >
                {hasYouTube ? (
                  <>
                    <div id={YT_CONTAINER_ID} className="h-full w-full" />
                    {showYoutubePauseOverlay && (
                      <button
                        type="button"
                        onClick={() => youtubeController.play()}
                        aria-label="tocar"
                        className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-void)] focus:outline-none"
                      >
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)]">
                          <PlayIcon className="h-7 w-7" />
                        </span>
                      </button>
                    )}
                  </>
                ) : hasVimeo ? (
                  <div id={VIMEO_CONTAINER_ID} className="h-full w-full" />
                ) : hasDirectMedia ? (
                  <NativeVideoPlayer containerId={NATIVE_CONTAINER_ID} />
                ) : hasGeneric ? (
                  <GenericIframe src={video.embedUrl!} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-[var(--ink-muted)]">
                    use &quot;carregar vídeo&quot; ao lado da presença pra começar
                  </div>
                )}
              </PlayerShell>
              <PlayerLoadStatus
                key={`${video?.embedUrl}-${video?.loadedAt}`}
                loading={playerLoading}
                error={playerError}
                sourceUrl={video?.sourceUrl ?? null}
              />
            </div>
          </SyncRing>

          {hasGeneric && (
            <p className="text-xs text-[var(--ink-muted)]">
              se a prévia não aparecer, o site pode não permitir incorporação —{" "}
              <a
                href={video!.embedUrl!}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[var(--ink)] underline"
              >
                abrir em nova aba
              </a>
              .
            </p>
          )}
        </div>

        {showAside && (
          <aside className="flex w-full min-h-0 flex-col gap-6 lg:min-w-72 lg:basis-[20%]">
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  presença
                </h2>
                <button
                  type="button"
                  onClick={() => setLoadModalOpen(true)}
                  className="flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
                >
                  <PlusIcon className="h-3 w-3" />
                  carregar vídeo
                </button>
              </div>
              <PresenceList myName={userName} />
            </section>
            <section className="flex min-h-0 flex-1 flex-col gap-3">
              <Chat userId={userId} userName={userName} />
            </section>
          </aside>
        )}
      </div>

      <LoadVideoModal
        roomCode={roomCode}
        userId={userId}
        open={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
      />
    </main>
  );
}
