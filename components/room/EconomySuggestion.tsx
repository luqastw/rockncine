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
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div className="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--ink)] shadow-lg">
        <p>
          Detectamos que seu dispositivo pode ter dificuldades com vídeo. Ativar
          modo economy?
        </p>
        <div className="flex items-center gap-2 self-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-[var(--ink-muted)] px-3 py-1.5 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-[var(--invert-bg)] px-3 py-1.5 text-xs font-medium text-[var(--invert-fg)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  );
}
