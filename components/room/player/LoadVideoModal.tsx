"use client";

import { useEffect, useRef, useState } from "react";
import { useLoadVideo } from "@/hooks/useLoadVideo";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CloseIcon } from "@/components/room/player/icons";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Input";
import { iconButtonClass } from "@/components/ui/IconButton";
import { modalOverlayClass, modalPanelClass } from "@/components/ui/Modal";
import { sectionLabelClass } from "@/components/ui/SectionLabel";

// Dialog próprio, sem dependência nova — overlay + painel, Escape/clique-fora
// fecha, foco vai pro input ao abrir. Absorve o form que antes ficava fixo
// embaixo do vídeo (ver docs/specs/01-fundacao-mvp/spec.md, seção 3/8).
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
  // o topo do documento (docs/specs/03-auditoria-ui-ux/spec.md, seção 10).
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

  // Tab/Shift+Tab preso no painel. Trap simples (só o painel tem elementos
  // focáveis nesta tela, então basta ciclar entre o primeiro e o último) e
  // compartilhado com o `ConfirmDialog` — a versão anterior desta lista de
  // focáveis era cópia literal da dele.
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    // Escape fecha, pelo `onClose` da ref: o chamador passa função inline e
    // usá-la como dependência re-inscreveria o listener a cada render do pai
    // enquanto o modal segue aberto.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={modalOverlayClass}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-video-modal-title"
        className={modalPanelClass}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="load-video-modal-title" className={sectionLabelClass}>
            carregar vídeo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            className={iconButtonClass({ variant: "ghost", surface: true })}
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
            aria-label="link do vídeo"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={inputClass({ surface: true, className: "min-w-0" })}
          />
          <Button type="submit" surface disabled={loading} className="shrink-0">
            {loading ? "carregando..." : "carregar"}
          </Button>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--ink)] bg-[var(--fill-1)] px-3 py-2 text-body-sm font-semibold text-[var(--ink)]"
            >
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
