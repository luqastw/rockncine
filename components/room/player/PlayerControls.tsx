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
  const max = Math.max(controller.duration, 0.01);
  const progressPct = Math.min(100, Math.max(0, (displayTime / max) * 100));
  const volumePct = (controller.isMuted ? 0 : controller.volume) * 100;

  // commit do seek acontecia só em mouseup/touchend: alterar o range pelo
  // teclado (setas/Home/End) mudava o número, nunca buscava no vídeo, e
  // `dragTime` ficava preso em não-nulo congelando o relógio (achado 8).
  const commitSeek = (value: number) => {
    controller.seek(value);
    setDragTime(null);
  };

  // gradiente no background do próprio input — o track dos pseudo-elementos é
  // transparente (.range-mono em globals.css), então isto é o que comunica
  // progresso (achado 13).
  const trackStyle = (pct: number): React.CSSProperties => ({
    // content-box só aqui — h-1 é a barra visível (4px) e py-5 vira área de
    // toque de 44px em volta, sem o border-box padrão do Tailwind comer a altura.
    boxSizing: "content-box",
    backgroundImage: `linear-gradient(to right, var(--ink) 0%, var(--ink) ${pct}%, var(--ink-muted) ${pct}%, var(--ink-muted) 100%)`,
    backgroundClip: "content-box",
  });

  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-void)]/90 px-2 py-2 sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={controller.togglePlay}
        disabled={!controller.isReady}
        aria-label={controller.isPlaying ? "pausar" : "tocar"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)] disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        {controller.isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
      </button>

      <span className="shrink-0 font-mono text-xs text-[var(--ink-muted)] tabular-nums">
        {formatTime(displayTime)}
        {/* duração total sai abaixo de sm: a barra tem ~370px de itens de
            largura fixa e estourava a caixa do vídeo em tela de 360px
            (achado 22). */}
        <span className="hidden sm:inline"> / {formatTime(controller.duration)}</span>
      </span>

      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={displayTime}
        disabled={!controller.isReady}
        onChange={(e) => setDragTime(Number(e.target.value))}
        onMouseUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => {
          if (dragTime !== null) commitSeek(Number((e.target as HTMLInputElement).value));
        }}
        onBlur={(e) => {
          if (dragTime !== null) commitSeek(Number(e.target.value));
        }}
        aria-label="progresso do vídeo"
        aria-valuetext={`${formatTime(displayTime)} de ${formatTime(controller.duration)}`}
        style={trackStyle(progressPct)}
        className="range-mono h-1 min-w-0 flex-1 cursor-pointer py-5 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <button
        type="button"
        onClick={controller.toggleMute}
        aria-label={controller.isMuted ? "reativar áudio" : "mutar"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
        style={trackStyle(volumePct)}
        className="range-mono hidden h-1 w-16 shrink-0 cursor-pointer py-5 sm:block"
      />

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "sair da tela cheia" : "tela cheia"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
