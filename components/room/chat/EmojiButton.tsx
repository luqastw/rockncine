import { useCallback, useEffect, useId, useRef, useState } from "react";
import { REACTION_EMOJIS } from "@/liveblocks.config";

/**
 * Botão de emoji com popover (FR-028 da onda 3 / `tasks.md` T-017).
 *
 * A fileira de seis emojis vivia em uma linha fixa de 44px acima do composer,
 * dentro de um painel de 272px. Em tela curta essa linha é o que empurra o
 * campo para fora da viewport — a medida que está no comentário do `aside`. Com
 * o popover, os emojis só existem enquanto alguém quer usá-los, e o painel
 * ganha 44px de log.
 *
 * Foco: abre levando o foco para o primeiro emoji, fecha com Escape devolvendo o
 * foco ao gatilho, e fecha em clique fora. Sem isso o popover vira um canto morto
 * para quem navega por teclado.
 */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const close = useCallback((devolverFoco: boolean) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector("button");
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (panelRef.current?.contains(target) || triggerRef.current?.contains(target))) return;
      close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Emoji"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--ink-muted)] text-base text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--fill-1)] reticle"
      >
        <EmojiIcon />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="Emojis"
          // `bottom-full` acima do botão: o popover abre para dentro da área do
          // log, que é onde o olho já está, e nunca empurra o composer para
          // baixo.
          className="absolute right-0 bottom-full z-30 mb-2 flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-pop)]"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onPick(emoji);
                triggerRef.current?.focus();
              }}
              aria-label={`inserir ${emoji} na mensagem`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-base hover:bg-[var(--fill-1)] reticle"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.8 1.1 2 1.7 3.5 1.7s2.7-.6 3.5-1.7" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  );
}
