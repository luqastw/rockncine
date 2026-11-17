import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SmileIcon } from "@/components/room/player/icons";
import { EmojiPicker } from "@/components/room/chat/EmojiPicker";

export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (layerRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
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
    <div className="shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        aria-label="Emoji"
        className="flex h-11 w-11 items-center justify-center rounded-sm border border-[var(--ink-muted)] text-base text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--fill-1)] reticle"
      >
        <SmileIcon className="size-5" />
      </button>
      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-30 bg-[var(--bg-void)]/70 animate-fade lg:hidden" />
          <div
            ref={layerRef}
            className="absolute right-0 bottom-full z-40 mb-2 w-[min(22rem,100%)] animate-rise drop-shadow-[0_4px_10px_rgb(0_0_0/0.5)] max-lg:-right-3 max-lg:-left-3 max-lg:w-auto sm:max-lg:-right-4 sm:max-lg:-left-4"
          >
            <EmojiPicker id={panelId} onPick={onPick} />
          </div>
        </>
      )}
    </div>
  );
}
