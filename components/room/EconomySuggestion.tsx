"use client";

// Toast não intrusivo que sugere modo economy para dispositivos fracos.
// Só renderiza quando `isLowEnd` é true e o usuário ainda não viu/dispôs a sugestão.
export function EconomySuggestion({
  isLowEnd,
  hasSeenSuggestion,
  onAccept,
  onDismiss,
}: {
  isLowEnd: boolean;
  hasSeenSuggestion: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (!isLowEnd || hasSeenSuggestion) return null;

  return (
    // `inset-x-4` + wrapper `pointer-events-none`: antes era `left-1/2` com
    // `-translate-x-1/2` e sem largura, e um elemento fixo com `left` e sem
    // `right` tem largura shrink-to-fit LIMITADA ao espaço da esquerda até a
    // borda — ou seja, metade da tela, espremendo a frase numa coluna estreita.
    // `pointer-events-none` no wrapper porque agora ele ocupa a largura toda e
    // engoliria os cliques no chat atrás dele; o painel devolve com `auto`.
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--ink)] shadow-lg"
      >
        <p>
          detectamos que seu dispositivo pode ter dificuldades com vídeo. ativar
          modo economy?
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            agora não
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            ativar economy
          </button>
        </div>
      </div>
    </div>
  );
}
