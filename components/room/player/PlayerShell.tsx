"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import { PlayerControls } from "@/components/room/player/PlayerControls";

const AUTO_HIDE_MS = 2500;

// Envolve o container do backend ativo + a barra de controles como overlay.
// Mostra a barra em mousemove/touch e some depois de AUTO_HIDE_MS parado —
// padrão comum de player em tela cheia. Fullscreen roda na div wrapper (não
// no iframe/video cru), pra a barra continuar visível dentro do fullscreen.
export function PlayerShell({
  controller,
  children,
}: {
  controller: PlaybackController | null;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="group relative h-full w-full"
      onMouseMove={wake}
      onTouchStart={wake}
    >
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
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      )}
    </div>
  );
}
