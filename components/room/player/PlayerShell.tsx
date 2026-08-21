"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import { PlayerControls } from "@/components/room/player/PlayerControls";
import { FullscreenEnterIcon, FullscreenExitIcon } from "@/components/room/player/icons";

const AUTO_HIDE_MS = 2500;

// Envolve o container do backend ativo + a barra de controles como overlay.
// Mostra a barra em mousemove/touch e some depois de AUTO_HIDE_MS parado.
// Fullscreen é decidido em RoomExperience (precisa envolver vídeo+chat pro
// modo teatro caber dentro da tela cheia) — este componente só recebe o
// estado e repassa pra PlayerControls, sem gerenciar requestFullscreen.
export function PlayerShell({
  controller,
  isFullscreen,
  onToggleFullscreen,
  showFullscreenOnly = false,
  children,
}: {
  controller: PlaybackController | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  // iframe genérico (GENERIC_IFRAME): não existe PlaybackController — não dá
  // pra tocar/pausar/buscar um iframe de terceiro — mas tela cheia é a única
  // porta pro modo teatro (chat ao lado, ver RoomActions/9.2), então precisa
  // de um botão mesmo sem barra de controles completa.
  showFullscreenOnly?: boolean;
  children: ReactNode;
}) {
  const hideTimerRef = useRef<number | null>(null);
  const [showControls, setShowControls] = useState(true);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), AUTO_HIDE_MS);
  }, []);

  const wake = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [scheduleHide]);

  // ao entrar/sair da tela cheia, mostra a barra na hora — senão ela pode já
  // estar escondida pelo timer de antes de alternar o modo. setState fica
  // dentro do callback assíncrono do timeout, não direto no corpo do efeito.
  useEffect(() => {
    const t = window.setTimeout(wake, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  return (
    <div className="group relative h-full w-full" onMouseMove={wake} onTouchStart={wake}>
      {children}
      {(controller || showFullscreenOnly) && (
        <div
          className={`absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200 ${
            showControls ? "opacity-100" : "invisible pointer-events-none opacity-0"
          }`}
        >
          {controller ? (
            <PlayerControls
              controller={controller}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
            />
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-label={isFullscreen ? "sair da tela cheia" : "tela cheia"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90 text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
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
