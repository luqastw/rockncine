"use client";

import type { ReactNode } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import type { FpsLimit } from "@/lib/playback/types";
import type { VideoSourceKind } from "@/lib/video-source";
import { PlayerControls } from "@/components/room/player/PlayerControls";
import { FullscreenEnterIcon, FullscreenExitIcon } from "@/components/room/player/icons";

export function PlayerShell({
  controller,
  isFullscreen,
  idle,
  onToggleFullscreen,
  showFullscreenOnly = false,
  sourceType,
  isSafari,
  fpsLimit,
  onToggleFps,
  onToggleResolution,
  captions,
  onToggleCaptions,
  children,
}: {
  controller: PlaybackController | null;
  isFullscreen: boolean;
  idle: boolean;
  onToggleFullscreen: () => void;
  // iframe genérico (GENERIC_IFRAME): não existe PlaybackController — não dá
  // pra tocar/pausar/buscar um iframe de terceiro — mas tela cheia é a única
  // porta pro modo teatro (chat ao lado, ver RoomActions/9.2), então precisa
  // de um botão mesmo sem barra de controles completa.
  showFullscreenOnly?: boolean;
  sourceType?: VideoSourceKind | null;
  isSafari?: boolean;
  fpsLimit?: FpsLimit;
  onToggleFps?: () => void;
  // Os setters de resolução/FPS NÃO vêm do controller: são preferência global
  // do app (hooks/useVideoQuality), então quem é dono do estado passa o handler
  // de cima pra baixo. O controller só informa `resolution` (ou `null` quando a
  // fonte não permite limitar qualidade), e é isso que habilita o botão.
  onToggleResolution?: () => void;
  // Mesma regra para legenda: `captions` é `null` quando a fonte não tem
  // controle de legenda (só o YouTube tem), e é o que habilita o botão.
  captions?: boolean | null;
  onToggleCaptions?: () => void;
  children: ReactNode;
}) {
  const alwaysVisible = !controller && showFullscreenOnly;
  const visible = !idle || alwaysVisible;

  return (
    <div className="group relative h-full w-full">
      {children}
      {controller && (
        <div
          aria-hidden
          className={`absolute inset-0 z-10 ${idle ? "cursor-none" : ""}`}
        />
      )}
      {(controller || showFullscreenOnly) && (
        <div
          data-idle-hold=""
          className={`absolute inset-x-0 bottom-0 z-30 p-2 transition-opacity duration-[calc(var(--motion-dur)*var(--motion-factor))] ${
            visible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {controller ? (
            <PlayerControls
              controller={controller}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              resolution={controller.resolution}
              onToggleResolution={onToggleResolution}
              fpsLimit={fpsLimit}
              onToggleFps={onToggleFps}
              sourceType={sourceType}
              isSafari={isSafari}
              captions={captions}
              onToggleCaptions={onToggleCaptions}
            />
          ) : (
            <div
              className={`flex justify-end ${
                alwaysVisible
                  ? "opacity-60 transition-opacity focus-within:opacity-100 hover:opacity-100"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-[var(--line)] bg-[rgb(15_26_20/0.9)] text-[var(--ink)] hover:bg-[var(--fill-2)] reticle"
              >
                {isFullscreen ? (
                  <FullscreenExitIcon className="h-4 w-4" />
                ) : (
                  <FullscreenEnterIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
