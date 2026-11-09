"use client";

import type { PlaybackController } from "@/hooks/playerController";
import type { RoomStorage } from "@/liveblocks.config";
import { GenericIframe } from "@/components/room/GenericIframe";
import { NativeVideoPlayer } from "@/components/room/NativeVideoPlayer";
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
}: {
  video: RoomStorage["video"] | null;
  hasYouTube: boolean;
  hasVimeo: boolean;
  hasDirectMedia: boolean;
  hasGeneric: boolean;
  storageLoading: boolean;
  youtubeController: PlaybackController;
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
              aria-label="tocar"
              // z-20: acima da camada que captura ponteiro sobre o
              // iframe (z-10 em PlayerShell) e ABAIXO da barra de
              // controles (z-30) — antes era z-10 e cobria a barra
              // inteira sempre que o vídeo estava pausado, deixando
              // tela cheia/scrubber/volume inclicáveis (achado 2).
              // anel de foco: era `focus:outline-none` sem anel
              // nenhum, num alvo que ocupa a tela inteira do player
              // (achado 17). `ring-inset` porque o botão sangra até
              // a borda da caixa.
              className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg-void)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--outline-strong)]"
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
        <GenericIframe src={video!.embedUrl!} />
      ) : storageLoading ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6">
          <span className="h-2 w-40 rounded-full bg-[var(--fill-1)]" aria-hidden />
          <span className="h-2 w-24 rounded-full bg-[var(--fill-1)]" aria-hidden />
          <span className="sr-only" role="status">
            carregando a sala
          </span>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center">
          <p className="text-title font-semibold tracking-tight text-[var(--ink)]">
            nenhum vídeo carregado
          </p>
          <p className="text-body-sm text-[var(--ink-muted)]">
            use &quot;carregar vídeo&quot; pra começar
          </p>
        </div>
    )
  );
}
