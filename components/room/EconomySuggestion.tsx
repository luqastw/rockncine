"use client";

import { Button } from "@/components/ui/Button";

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
    // `inset-x-4` + wrapper `pointer-events-none`: um elemento fixo com `left`
    // e sem `right` tem largura shrink-to-fit LIMITADA ao espaço da esquerda até
    // a borda. `pointer-events-none` no wrapper porque ele ocupa a largura toda
    // e engoliria os cliques no chat atrás dele; o painel devolve com `auto`.
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] p-4 text-body-sm text-[var(--ink)] shadow-[var(--shadow-pop)]"
      >
        <p>
          detectamos que seu dispositivo pode ter dificuldades com vídeo. ativar
          modo economy?
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" surface onClick={onDismiss}>
            agora não
          </Button>
          <Button variant="primary" surface onClick={onAccept}>
            ativar economy
          </Button>
        </div>
      </div>
    </div>
  );
}
