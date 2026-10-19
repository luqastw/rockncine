// Classes compartilhadas dos diálogos. O comportamento (focus trap, Escape,
// clique-fora, foco devolvido) continua em cada componente; aqui mora só a
// superfície visual — painel de 16px de raio, borda de 1px e sombra de popover.
export const modalOverlayClass =
  "animate-fade fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] px-4";

export const modalPanelClass =
  "animate-pop w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-pop)]";
