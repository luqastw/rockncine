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
  sourceType,
  isSafari,
  fpsLimit,
  onToggleFps,
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
  sourceType?: "YOUTUBE" | "VIMEO" | "DIRECT_MEDIA" | "GENERIC_IFRAME" | null;
  isSafari?: boolean;
  fpsLimit?: "auto" | "30" | "60";
  onToggleFps?: () => void;
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

  // A barra só reaparece com um evento de ponteiro/foco que chegue até aqui.
  // Quando o backend é um iframe (YouTube/Vimeo), TODA a área do player é
  // ocupado por uma janela cross-origin: nenhum mousemove de dentro dela
  // atravessa pro parent, então, uma vez escondida, a barra ficava
  // inalcançável (achado 1 da auditoria). A camada abaixo devolve essa área
  // pro nosso documento. Só é montada quando existe `controller` — nesse caso
  // o player de dentro está com o chrome nativo desligado e não há nada pra
  // clicar lá. Para GENERIC_IFRAME (sem controller) o usuário PRECISA clicar
  // dentro do iframe, então nada é sobreposto e a barra mínima não some por
  // inatividade (ver `alwaysVisible` abaixo).
  const alwaysVisible = !controller && showFullscreenOnly;
  const visible = showControls || alwaysVisible;

  return (
    <div
      className="group relative h-full w-full"
      onMouseMove={wake}
      onTouchStart={wake}
      onFocusCapture={wake}
    >
      {children}
      {controller && (
        <div
          aria-hidden
          className="absolute inset-0 z-10"
          onMouseMove={wake}
          onPointerMove={wake}
          onClick={wake}
        />
      )}
      {(controller || showFullscreenOnly) && (
        <div
          className={`absolute inset-x-0 bottom-0 z-30 p-2 transition-opacity duration-200 ${
            visible
              ? "opacity-100"
              : // `opacity-0` (e não `invisible`) de propósito: `visibility:
                // hidden` tira os controles da ordem de tabulação e não existe
                // nenhum outro caminho de teclado até eles (achado 3). O custo
                // de compositor que motivou o `invisible` na seção 9.3 era do
                // `backdrop-filter`, que já não existe nesta barra.
                "pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100"
          }`}
        >
          {controller ? (
            <PlayerControls
              controller={controller}
              isFullscreen={isFullscreen}
              onToggleFullscreen={onToggleFullscreen}
              resolution={controller.resolution}
              onToggleResolution={
                controller.setResolution
                  ? () =>
                      controller.setResolution!(
                        controller.resolution === "720p" ? "480p" : "720p",
                      )
                  : undefined
              }
              fpsLimit={fpsLimit}
              onToggleFps={onToggleFps}
              sourceType={sourceType}
              isSafari={isSafari}
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
                aria-label={isFullscreen ? "sair da tela cheia" : "tela cheia"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--ink-muted)] bg-[var(--bg-void)]/90 text-[var(--ink)] hover:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
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
