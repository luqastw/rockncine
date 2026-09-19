"use client";

import { useState } from "react";
import type { PlaybackController } from "@/hooks/playerController";
import type { FpsLimit, Resolution } from "@/lib/playback/types";
import type { VideoSourceKind } from "@/lib/video-source";
import {
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  VolumeMutedIcon,
} from "@/components/room/player/icons";

// O motivo de a resolução estar indisponível, em uma função em vez do ternário
// de três níveis que vivia dentro do `title`.
function resolutionUnavailableReason(
  sourceType: VideoSourceKind | null | undefined,
  isSafari?: boolean,
): string {
  if (sourceType === "YOUTUBE") return "o YouTube controla a qualidade automaticamente";
  if (isSafari) return "o Safari controla a qualidade automaticamente";
  return "esta fonte não suporta mudança de resolução";
}

// Classe dos botões de estado (resolução/FPS): o sufixo de desabilitado era
// copiado literalmente nos dois.
//
// `min-h-[44px]` (px, não `min-h-11`) e borda `--ink-muted` (não `--line`) para
// bater com o resto da própria barra: era `h-8` (32px medidos) com o token que
// o projeto reserva a divisor decorativo, e ficavam os dois únicos alvos abaixo
// do piso de 44px em todo o app (achado 2 da revisão de design).
//
// O px é deliberado e vale para os controles desta barra: ela é um overlay
// sobre o vídeo, então não pode crescer junto com o texto do usuário — com
// `min-h-11` (rem) a 200% de texto cada botão virava 88px, a barra quebrava em
// cinco linhas e ficava com 434px de altura sobre um vídeo de 163 (medido).
// Alvo de toque é físico; quem escala é o rótulo.
function toggleButtonClass(disabled: boolean): string {
  return `flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-[var(--ink-muted)] px-3 font-mono text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]${
    disabled ? " cursor-not-allowed opacity-50" : ""
  }`;
}

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
  resolution,
  onToggleResolution,
  fpsLimit,
  onToggleFps,
  sourceType,
  isSafari,
}: {
  controller: PlaybackController;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  resolution?: Resolution | null;
  onToggleResolution?: () => void;
  fpsLimit?: FpsLimit;
  onToggleFps?: () => void;
  sourceType?: VideoSourceKind | null;
  isSafari?: boolean;
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
    // Uma linha que rola no eixo X quando não couber (`flex-nowrap` +
    // `overflow-x-auto`), e NÃO quebra em várias linhas: a barra é um overlay
    // dentro da caixa do vídeo, que tem `overflow-hidden`. Com `flex-wrap` a
    // 200% de texto ela quebrava em cinco linhas e ficava com 242px de altura
    // sobre um vídeo de 163 — e o botão de play, na primeira linha, era
    // RECORTADO inteiro (medido: retângulo em y 236–280 contra uma caixa
    // começando em y 314). Uma linha nunca fica mais alta que o vídeo; o que
    // não couber fica a um swipe (e a um Tab: o browser rola o item focado para
    // dentro da vista) de distância. `min-w-[96px]` no slider para ele não
    // voltar a zero (achado 13 da revisão de design).
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-md border border-[var(--ink-muted)] bg-[var(--bg-void)]/90 px-2 py-2 sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={controller.togglePlay}
        disabled={!controller.isReady}
        aria-label={controller.isPlaying ? "pausar" : "tocar"}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)] disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
        // O anel de foco entra aqui porque os dois ranges eram os ÚNICOS
        // controles do app sem ele: sobrava o `outline: auto` do browser, de
        // 1px e sem offset, enquanto todo o resto usa 2px + offset (achado 6 da
        // revisão de design). O box do anel é a caixa de 44px que o `py-5` com
        // `boxSizing: content-box` já cria, não a barra de 4px.
        className="range-mono h-1 min-w-[96px] flex-1 cursor-pointer py-5 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      />

      <button
        type="button"
        onClick={controller.toggleMute}
        aria-label={controller.isMuted ? "reativar áudio" : "mutar"}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
        // mesmo anel de foco do scrubber — ver comentário lá (achado 6).
        className="range-mono hidden h-1 w-16 shrink-0 cursor-pointer py-5 sm:block focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      />

      {sourceType && sourceType !== "GENERIC_IFRAME" && (
        <button
          type="button"
          // `disabled` já barra o clique; antes havia também um
          // `onClick={resolution !== null ? … : undefined}`, que deixava o
          // botão habilitado e inerte quando o handler não vinha.
          onClick={onToggleResolution}
          disabled={resolution === null}
          title={resolution === null ? resolutionUnavailableReason(sourceType, isSafari) : undefined}
          aria-label={`resolução: ${resolution ?? "indisponível"}`}
          // Desabilitado e estreito: sai de cena abaixo de `sm`. A explicação do
          // porquê vive no `title`, que não existe no toque — num telefone o
          // botão é um alvo morto ocupando a barra inteira. De `sm` para cima há
          // espaço para mostrar o estado indisponível.
          className={`${resolution === null ? "hidden sm:flex" : "flex"} ${toggleButtonClass(resolution === null)}`}
        >
          {resolution ?? "—"}
        </button>
      )}

      {sourceType && sourceType !== "GENERIC_IFRAME" && (
        <button
          type="button"
          onClick={onToggleFps}
          disabled={!onToggleFps}
          title={!onToggleFps ? "esta fonte não suporta limite de FPS" : undefined}
          aria-label={`fps: ${fpsLimit ?? "auto"}`}
          className={`hidden sm:flex ${toggleButtonClass(!onToggleFps)}`}
        >
          {fpsLimit === "auto" ? "Auto" : `${fpsLimit}fps`}
        </button>
      )}

      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "sair da tela cheia" : "tela cheia"}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
