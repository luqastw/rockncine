"use client";

import { PlusIcon, TheaterIcon } from "@/components/room/player/icons";

// Par de botões renderizado sempre com a mesma ordem/estilo — só a âncora
// muda conforme o estado de tela cheia (ver SPEC.md seção 9.2). Nunca
// renderizado duas vezes ao mesmo tempo.
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
        className="flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
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
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
        >
          <TheaterIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
