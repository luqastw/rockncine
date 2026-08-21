"use client";

import { PlusIcon, TheaterIcon } from "@/components/room/player/icons";

// Par de botões renderizado sempre com a mesma ordem/estilo — só a âncora
// muda conforme o estado de tela cheia (ver SPEC.md seção 9.2). Pode existir
// em duas instâncias no DOM ao mesmo tempo (aside sempre montado desde a
// seção 9.6), mas nunca mais de uma visível — a outra fica `hidden`.
export function RoomActions({
  onLoadVideo,
  onToggleTheater,
  isTheater,
  showTheaterToggle,
}: {
  onLoadVideo: () => void;
  onToggleTheater: () => void;
  isTheater: boolean;
  showTheaterToggle: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onLoadVideo}
        className="flex min-h-11 items-center gap-1 rounded-md border border-[var(--ink-muted)] px-3 py-2 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
      >
        <PlusIcon className="h-3 w-3" />
        carregar vídeo
      </button>
      {showTheaterToggle && (
        <button
          type="button"
          onClick={onToggleTheater}
          aria-label={isTheater ? "expandir vídeo" : "abrir chat ao lado"}
          aria-pressed={isTheater}
          // escondido abaixo de lg: teatro pressupõe as duas colunas lado a
          // lado (SPEC.md seção 9.1/10) — empilhado, o cálculo de altura do
          // vídeo não desconta o aside, e o chat fica espremido/cortado.
          className="hidden h-11 w-11 items-center justify-center rounded-md border border-[var(--ink-muted)] text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)] lg:flex"
        >
          <TheaterIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
