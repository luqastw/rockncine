"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import { PlayerControls } from "@/components/room/player/PlayerControls";

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
  children,
}: {
  controller: PlaybackController | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
      {controller && (
        <div
          className={`absolute inset-x-0 bottom-0 p-2 transition-opacity duration-200 ${
            showControls ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <PlayerControls
            controller={controller}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
          />
        </div>
      )}
    </div>
  );
}
