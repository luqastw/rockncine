"use client";

import { useEffect, useId, useRef, type RefObject } from "react";

// Dialog de confirmação para ação irreversível. Mesmo padrão de acessibilidade
// já validado em LoadVideoModal (overlay, role=dialog, aria-modal, trap de Tab,
// Escape, clique-fora, foco devolvido a quem abriu) — duplicar o trap de foco
// dentro de cada chamador criaria um segundo lugar para ele divergir.
//
// Escopo deliberadamente mínimo: não é a extração ampla de `components/ui`,
// que segue adiada para o redesign.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busyLabel = "processando...",
  cancelLabel = "cancelar",
  busy = false,
  error = null,
  onConfirm,
  onClose,
  triggerRef,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  // Ref do elemento que abre o dialog. Passar explicitamente é mais confiável
  // que ler `document.activeElement` no momento em que abre: clicar num botão
  // nem sempre o foca (Safari não foca; o jsdom também não), e nesse caso a
  // devolução de foco do FR-014 simplesmente não aconteceria.
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  // fallback quando o chamador não passa `triggerRef`.
  const capturedTriggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  // O `onClose` mais recente em ref, e não nas deps do efeito de teclado: o
  // chamador passa função inline, e usá-la como dependência re-inscreveria o
  // listener (e roubaria o foco de novo) a cada re-render do pai.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      capturedTriggerRef.current =
        triggerRef?.current ?? (document.activeElement as HTMLElement | null);
      return;
    }
    const target = triggerRef?.current ?? capturedTriggerRef.current;
    target?.focus();
    capturedTriggerRef.current = null;
  }, [open, triggerRef]);

  // Foco inicial no "cancelar", não no destrutivo: com o foco no botão de
  // confirmar, um Enter reflexo apagaria a sala.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Escape fecha; Tab/Shift+Tab fica preso no painel. Depende só de `open`.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="animate-pop flex w-full max-w-md flex-col gap-4 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-5"
      >
        <h2
          id={titleId}
          className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]"
        >
          {title}
        </h2>
        <p id={descriptionId} className="text-sm text-[var(--ink)]">
          {description}
        </p>

        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--ink)]"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
