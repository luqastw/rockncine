"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStatus, useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useVimeoSync } from "@/hooks/useVimeoSync";
import { useNativeVideoSync } from "@/hooks/useNativeVideoSync";
import { useLastRoomEvent } from "@/hooks/useLastRoomEvent";
import { useRoomJoinAnnouncement } from "@/hooks/useRoomJoinAnnouncement";
import { SyncRing } from "@/components/room/SyncRing";
import { PresenceList } from "@/components/room/PresenceList";
import { GenericIframe } from "@/components/room/GenericIframe";
import { NativeVideoPlayer } from "@/components/room/NativeVideoPlayer";
import { PlayerLoadStatus } from "@/components/room/PlayerLoadStatus";
import { PlayerShell } from "@/components/room/player/PlayerShell";
import { LoadVideoModal } from "@/components/room/player/LoadVideoModal";
import { RoomActions } from "@/components/room/RoomActions";
import { PlayIcon } from "@/components/room/player/icons";
import { Chat } from "@/components/room/Chat";

// respiro em tela cheia — declarado uma vez, usado no padding do stage e no
// cálculo de altura máxima da caixa do vídeo (SPEC.md seção 9.1).
const FULLSCREEN_PAD = "clamp(0.75rem,2.5vmin,2.5rem)";

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
  roomName,
  userId,
  userName,
}: {
  roomCode: string;
  roomName: string | null;
  userId: string;
  userName: string;
}) {
  const video = useStorage((root) => root.video);
  const player = useStorage((root) => root.player);
  const lastEvent = useLastRoomEvent();
  const status = useStatus();
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  // fica aqui (nível de sala, sempre montado) e não dentro de <Chat> — o
  // aside com o Chat desmonta/remonta ao entrar em fullscreen ou alternar
  // teatro, o que reenviava "entrou na sala" a cada toggle (bug real).
  useRoomJoinAnnouncement(userName);

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
    <main className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col gap-6 px-6 py-8">
      <header className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm text-[var(--ink)]">{roomName || "sala sem nome"}</h1>
          <span className="font-mono text-xs text-[var(--ink-muted)]">{roomCode}</span>
          {player?.isPlaying && !syncLimited && (
            <span className="rounded-full bg-[var(--invert-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--invert-fg)]">
              ao vivo
            </span>
          )}
        </div>
        {connectionLabel ? (
          <span className="font-mono text-xs text-[var(--ink-muted)]">{connectionLabel}</span>
        ) : (
          player &&
          !syncLimited &&
          !player.isPlaying && (
            <span className="font-mono text-xs text-[var(--ink-muted)]">○ pausado</span>
          )
        )}
      </header>

      <div
        ref={stageRef}
        style={
          isFullscreen
            ? ({ padding: FULLSCREEN_PAD, "--fs-pad": FULLSCREEN_PAD } as React.CSSProperties)
            : undefined
        }
        className={`relative flex flex-1 flex-col gap-6 bg-[var(--bg-void)] lg:flex-row ${
          isFullscreen ? "h-dvh w-dvw overflow-hidden" : ""
        }`}
      >
        <div
          className={`relative flex flex-col gap-4 ${
            showAside ? "lg:basis-[80%]" : "w-full"
          } ${isFullscreen ? "min-h-0 flex-1 justify-center" : ""}`}
        >
          {isFullscreen && !isTheater && (
            <div className="absolute right-3 top-3 z-20 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100">
              <RoomActions
                onLoadVideo={() => setLoadModalOpen(true)}
                onToggleTheater={() => setIsTheater((v) => !v)}
                isTheater={isTheater}
                showTheaterToggle
              />
            </div>
          )}

          <SyncRing
            isPlaying={player?.isPlaying ?? false}
            source={video?.source ?? null}
            lastEvent={lastEvent}
          >
            <div
              className={`relative aspect-video w-full overflow-hidden rounded-md bg-black ${
                isFullscreen ? "mx-auto max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))]" : ""
              }`}
            >
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
          <aside
            className={`flex w-full min-h-0 flex-col gap-6 lg:min-w-72 lg:basis-[20%] ${
              isFullscreen && isTheater
                ? "rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-4"
                : ""
            }`}
          >
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  presença
                </h2>
                <RoomActions
                  onLoadVideo={() => setLoadModalOpen(true)}
                  onToggleTheater={() => setIsTheater((v) => !v)}
                  isTheater={isTheater}
                  showTheaterToggle={isFullscreen}
                />
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
