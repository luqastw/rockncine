"use client";

import { useState } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import {
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "@/components/room/player/icons";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Apresentacional, agnóstico de backend — não sabe se está driving YouTube,
// Vimeo ou <video> nativo, só chama os métodos do controller.
export function PlayerControls({
  controller,
  isFullscreen,
  onToggleFullscreen,
}: {
  controller: PlaybackController;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  // valor local do scrubber durante o arraste — só chama seek() no soltar,
  // não a cada tick, pra não gerar um broadcast por pixel arrastado.
  const [dragTime, setDragTime] = useState<number | null>(null);
  const displayTime = dragTime ?? controller.currentTime;

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90 px-3 py-2 backdrop-blur-sm">
      <button
        type="button"
        onClick={controller.togglePlay}
        disabled={!controller.isReady}
        aria-label={controller.isPlaying ? "pausar" : "tocar"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)] disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        {controller.isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>

      <span className="shrink-0 font-mono text-xs text-[var(--ink-muted)] tabular-nums">
        {formatTime(displayTime)} / {formatTime(controller.duration)}
      </span>

      <input
        type="range"
        min={0}
        max={Math.max(controller.duration, 0.01)}
        step={0.1}
        value={displayTime}
        disabled={!controller.isReady}
        onChange={(e) => setDragTime(Number(e.target.value))}
        onMouseUp={(e) => {
          controller.seek(Number((e.target as HTMLInputElement).value));
          setDragTime(null);
        }}
        onTouchEnd={(e) => {
          controller.seek(Number((e.target as HTMLInputElement).value));
          setDragTime(null);
        }}
        aria-label="progresso do vídeo"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
      />

      <button
        type="button"
        onClick={controller.toggleMute}
        aria-label={controller.isMuted ? "reativar áudio" : "mutar"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        {controller.isMuted ? (
          <VolumeMutedIcon className="h-4 w-4" />
        ) : (
          <VolumeHighIcon className="h-4 w-4" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={controller.isMuted ? 0 : controller.volume}
        onChange={(e) => controller.setVolume(Number(e.target.value))}
        aria-label="volume"
        className="h-1 w-16 shrink-0 cursor-pointer accent-[var(--ink)]"
      />

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "sair da tela cheia" : "tela cheia"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        {isFullscreen ? (
          <FullscreenExitIcon className="h-4 w-4" />
        ) : (
          <FullscreenEnterIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
