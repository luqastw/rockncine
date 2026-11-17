"use client";

import { memo } from "react";
import { LeafIcon, PlusIcon, TheaterIcon } from "@/components/room/player/icons";
import { buttonClass } from "@/components/ui/Button";
import { iconButtonClass } from "@/components/ui/IconButton";

// Par de botões renderizado sempre com a mesma ordem/estilo — só a âncora
// muda conforme o estado de tela cheia (ver docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.2). Pode existir
// em duas instâncias no DOM ao mesmo tempo (aside sempre montado desde a
// seção 9.6), mas nunca mais de uma visível — a outra fica `hidden`.
//
// `flex-wrap` + `shrink-0` nos botões: no modo teatro o painel da `aside` fica
// com 256px de conteúdo e os três botões somam 262 — sem quebra, a fileira
// transbordava ~50px para fora do painel e o botão de teatro era espremido a
// 34px e recortado (medido: fileira em l=972..1215 com o painel terminando em
// 1181). Quebrando em duas linhas, os três ficam inteiros e clicáveis. Fora do
// teatro nada muda: "carregar vídeo" + o botão de economy somam 176px e cabem
// nos 256px.
// `memo` é defesa em profundidade, não o isolamento (FR-010,
// docs/specs/13-chat-sala/spec.md): o isolamento real vem do feed de chat viver
// fora do estado da sala. As props aqui são todas estáveis — três booleanos e
// três `useCallback` — então evento de presença ou de sync não redesenha a
// fileira. `PlayerShell` NÃO entra nesta lista: recebe `controller`, que os
// hooks de sync recriam a cada render, e memoizar ali seria placebo.
export const RoomActions = memo(function RoomActions({
  onLoadVideo,
  onToggleTheater,
  isTheater,
  showTheaterToggle,
  onToggleEconomy,
  isEconomy,
}: {
  onLoadVideo: () => void;
  onToggleTheater: () => void;
  isTheater: boolean;
  showTheaterToggle: boolean;
  onToggleEconomy: () => void;
  isEconomy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onLoadVideo}
        aria-label="Carregar vídeo"
        title="Carregar vídeo"
        className={buttonClass({
          variant: "primary",
          size: "sm",
          className: "shrink-0",
        })}
      >
        <PlusIcon className="size-4" />
        <span className="max-sm:inline sm:hidden xl:inline">Carregar vídeo</span>
      </button>
      <button
        type="button"
        onClick={onToggleEconomy}
        aria-label={isEconomy ? "Desativar modo economy" : "Ativar modo economy"}
        aria-pressed={isEconomy}
        title={isEconomy ? "Desativar modo economy" : "Ativar modo economy"}
        className={buttonClass({
          variant: "ghost",
          size: "sm",
          className: `shrink-0 ${isEconomy ? "border border-[var(--leaf)] bg-[var(--fill-2)] text-[var(--ink)]" : ""}`,
        })}
      >
        <LeafIcon className="size-4" />
        <span className="max-sm:inline sm:hidden xl:inline">Economy</span>
      </button>
      {showTheaterToggle && (
        <button
          type="button"
          onClick={onToggleTheater}
          aria-label={isTheater ? "Expandir vídeo" : "Abrir chat ao lado"}
          aria-pressed={isTheater}
          title={isTheater ? "Expandir vídeo" : "Abrir chat ao lado"}
          className={iconButtonClass({
            variant: "ghost",
            className: "shrink-0 max-lg:hidden lg:inline-flex",
          })}
        >
          <TheaterIcon className="size-5" />
        </button>
      )}
    </div>
  );
});
