"use client";

import { useEffect, useRef, useState } from "react";
import { useLoadVideo } from "@/hooks/useLoadVideo";
import { CloseIcon } from "@/components/room/player/icons";

// Dialog próprio, sem dependência nova — overlay + painel, Escape/clique-fora
// fecha, foco vai pro input ao abrir. Absorve o form que antes ficava fixo
// embaixo do vídeo (ver SPEC.md seção 3/8).
export function LoadVideoModal({
  roomCode,
  userId,
  open,
  onClose,
}: {
  roomCode: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const loadVideo = useLoadVideo(roomCode, userId);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // guarda quem tinha foco antes de abrir (o botão "carregar vídeo" que
  // disparou o modal) — devolve o foco pra lá ao fechar, senão ele some pra
  // o topo do documento (SPEC.md seção 10).
  const triggerRef = useRef<HTMLElement | null>(null);
  // guarda o `onClose` mais recente sem entrar como dep do efeito de
  // teclado abaixo — se o chamador passar uma função inline não-memoizada
  // (como `RoomExperience` fazia antes), cada um dos re-renders dele durante
  // o modal aberto NÃO deve re-montar o listener/limpar o erro/roubar o foco
  // de novo (bug real: reviewer achou isso em cima da spec 10, corrigido
  // aqui e não só no chamador — defesa em profundidade).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setError(null);
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Escape fecha; Tab/Shift+Tab fica preso no painel (trap de foco simples
    // — só o painel tem elementos focáveis nesta tela, então basta ciclar
    // entre o primeiro e o último). Depende só de `open`: não recria o
    // listener a cada re-render do pai enquanto o modal segue aberto.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-video-modal-title"
        className="w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--bg-surface)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="load-video-modal-title"
            className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]"
          >
            carregar vídeo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              await loadVideo(url);
              setUrl("");
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "erro ao carregar link.");
            } finally {
              setLoading(false);
            }
          }}
          className="flex flex-col gap-3"
        >
          <input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="cole um link (YouTube, Vimeo, mídia direta, outro)"
            className="min-h-11 w-full min-w-0 rounded-md border border-[var(--line)] bg-[var(--bg-void)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 shrink-0 rounded-md bg-[var(--invert-bg)] px-4 text-sm font-medium text-[var(--invert-fg)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-surface)]"
          >
            {loading ? "carregando..." : "carregar"}
          </button>
          {error && (
            <p className="rounded-md border-2 border-[var(--ink)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
