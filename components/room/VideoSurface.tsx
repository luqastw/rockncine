"use client";

import type { PlaybackController } from "@/hooks/playerController";
import type { RoomStorage } from "@/liveblocks.config";
import { GenericIframe } from "@/components/room/GenericIframe";
import { NativeVideoPlayer } from "@/components/room/NativeVideoPlayer";
import { EmptyPlayer } from "@/components/room/player/EmptyPlayer";
import { PlayIcon } from "@/components/room/player/icons";

export const YT_CONTAINER_ID = "yt-player";
export const VIMEO_CONTAINER_ID = "vimeo-player";
export const NATIVE_CONTAINER_ID = "native-player";

export function VideoSurface({
  video,
  hasYouTube,
  hasVimeo,
  hasDirectMedia,
  hasGeneric,
  storageLoading,
  youtubeController,
  roomCode,
  userId,
}: {
  video: RoomStorage["video"] | null;
  hasYouTube: boolean;
  hasVimeo: boolean;
  hasDirectMedia: boolean;
  hasGeneric: boolean;
  storageLoading: boolean;
  youtubeController: PlaybackController;
  roomCode: string;
  userId: string;
}) {
  // YouTube não tem parâmetro oficial pra desligar a tela de sugestões que
  // desenha por cima ao pausar (ver docs/specs/01-fundacao-mvp/spec.md, seção 7) — cobrimos com um
  // overlay nosso, que também funciona como affordance extra de play.
  const showYoutubePauseOverlay = hasYouTube && youtubeController.isReady && !youtubeController.isPlaying;

  return (
    hasYouTube ? (
        <>
          <div id={YT_CONTAINER_ID} className="h-full w-full" />
          {showYoutubePauseOverlay && (
            <button
              type="button"
              onClick={() => youtubeController.play()}
              aria-label="Tocar"
              // z-20: acima da camada que captura ponteiro sobre o
              // iframe (z-10 em PlayerShell) e ABAIXO da barra de
              // controles (z-30) — antes era z-10 e cobria a barra
              // inteira sempre que o vídeo estava pausado, deixando
              // tela cheia/scrubber/volume inclicáveis (achado 2).
              // foco: alvo que ocupa a tela inteira do player
              // (achado 17); os colchetes da classe `reticle` ficam
              // dentro da área, porque o botão sangra até a borda.
              className="group absolute inset-0 z-20 flex items-center justify-center bg-black reticle"
            >
              <span className="flex size-16 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--bg-surface)] text-[var(--gold-hi)] transition-colors duration-150 group-hover:bg-[var(--gold)] group-hover:text-[var(--bg-void)]">
                <PlayIcon className="size-7" />
              </span>
            </button>
          )}
        </>
      ) : hasVimeo ? (
        <div id={VIMEO_CONTAINER_ID} className="h-full w-full" />
      ) : hasDirectMedia ? (
        <NativeVideoPlayer containerId={NATIVE_CONTAINER_ID} />
      ) : hasGeneric ? (
        <GenericIframe src={video!.embedUrl!} />
      ) : storageLoading ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6">
          <span className="h-2 w-40 rounded-full bg-[var(--fill-1)]" aria-hidden />
          <span className="h-2 w-24 rounded-full bg-[var(--fill-1)]" aria-hidden />
          <span className="sr-only" role="status">
            Carregando a sala
          </span>
        </div>
      ) : (
        <EmptyPlayer roomCode={roomCode} userId={userId} />
    )
  );
}
