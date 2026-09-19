"use client";

import { PlusIcon, TheaterIcon } from "@/components/room/player/icons";

function EconomyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L6 8l6-1 6 1-6-6z" />
      <path d="M12 22V8" />
      <path d="M6 8c0 0 0 8 6 14" />
      <path d="M18 8c0 0 0 8-6 14" />
    </svg>
  );
}

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
export function RoomActions({
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
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[var(--ink-muted)] px-3 py-2 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        <PlusIcon className="h-3 w-3" />
        carregar vídeo
      </button>
      <button
        type="button"
        onClick={onToggleEconomy}
        aria-label={isEconomy ? "desativar modo economy" : "ativar modo economy"}
        aria-pressed={isEconomy}
        title={isEconomy ? "desativar modo economy" : "ativar modo economy"}
        // Só ícone (44x44): com o rótulo "economy" a fileira precisava de 225px
        // e a coluna da presença oferece ~190 (h2 + os dois botões somam 280 num
        // espaço de 256–272) — era isso que espremia "carregar vídeo" em duas
        // linhas dentro do próprio botão e, no modo teatro, empurrava o botão de
        // teatro para fora do painel. O nome continua no `aria-label` e o estado
        // também aparece no chip do cabeçalho quando o modo está ligado.
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] ${
          isEconomy
            ? "border-[var(--ink)] text-[var(--ink)] bg-[var(--bg-surface)]"
            : "border-[var(--ink-muted)] text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
        }`}
      >
        <EconomyIcon className="h-4 w-4" />
      </button>
      {showTheaterToggle && (
        <button
          type="button"
          onClick={onToggleTheater}
          aria-label={isTheater ? "expandir vídeo" : "abrir chat ao lado"}
          aria-pressed={isTheater}
          // escondido abaixo de lg: teatro pressupõe as duas colunas lado a
          // lado (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.1 / docs/specs/03-auditoria-ui-ux/spec.md, seção 10) — empilhado, o cálculo de altura do
          // vídeo não desconta o aside, e o chat fica espremido/cortado.
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--ink-muted)] text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] lg:flex"
        >
          <TheaterIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
