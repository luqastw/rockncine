"use client";

import { useEffect, useRef } from "react";
import type { PlaybackController } from "@/hooks/playerController";

export const SEEK_STEP_S = 5;

export function useRoomShortcuts({
  activeController,
  loadModalOpen,
  cssFullscreen,
  isBroadcasting,
  toggleFullscreen,
  exitCssFullscreen,
}: {
  activeController: PlaybackController | null;
  loadModalOpen: boolean;
  cssFullscreen: boolean;
  isBroadcasting: boolean;
  toggleFullscreen: () => void;
  exitCssFullscreen: () => void;
}) {
  // Os hooks de sync recriam o objeto `controller` a cada render. Com
  // `activeController` nas deps do listener de teclado abaixo, o handler
  // global seria removido e re-adicionado a cada render durante toda a sessão.
  // A ref mantém o valor corrente sem entrar no ciclo de inscrição.
  //
  // O comentário original citava os 2,5–4 Hz de re-render como o motivo
  // (polling do YouTube, `timeupdate` do `<video>`) — essa frequência saiu do
  // caminho quando o playhead foi para a store externa, mas a troca de
  // identidade do objeto a cada render continua valendo, e o sintoma (listener
  // global re-inscrito o tempo todo) é o mesmo.
  const controllerRef = useRef(activeController);
  useEffect(() => {
    controllerRef.current = activeController;
  });

  // Atalhos de teclado do player (achado 27). Ignorados enquanto o foco está
  // num campo de texto ou o modal está aberto — senão espaço/f/m viravam
  // caracteres perdidos no meio de uma mensagem do chat.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        loadModalOpen ||
        (target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable))
      ) {
        return;
      }

      // Sem essa guarda, `preventDefault()` sequestrava Ctrl+F/Cmd+F (busca
      // do browser), Ctrl+K (barra de endereço em alguns browsers) e Cmd+M
      // (minimizar no macOS) — nenhum atalho deste handler tem combinação
      // com modificador, então qualquer tecla com Ctrl/Cmd/Alt não é dele
      // (achado 5, docs/specs/05-code-review-seguranca/spec.md).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape" && cssFullscreen) {
        exitCssFullscreen();
        return;
      }
      if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // lido da ref, não do estado: ver comentário em `controllerRef` acima.
      const controller = controllerRef.current;
      if (!controller?.isReady) return;

      // No modo transmissão o player não está na tela: os frames são a
      // sincronização (docs/specs/12-transmissao-screen-share/spec.md, seção 1).
      // Sem esta guarda, espaço/m/f agiram sobre o player escondido que ainda
      // está montado por baixo — e mudavam o volume de um vídeo que ninguém vê.
      if (isBroadcasting) return;

      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        controller.togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        controller.seek(Math.max(controller.currentTime - SEEK_STEP_S, 0));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        controller.seek(controller.currentTime + SEEK_STEP_S);
      } else if (e.key === "m") {
        e.preventDefault();
        controller.toggleMute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cssFullscreen, loadModalOpen, toggleFullscreen, exitCssFullscreen, isBroadcasting]);
}
