"use client";

import { memo, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_TIMEOUT_MS = 2000;

export const InviteCode = memo(function InviteCode({ code }: { code: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (status === "idle") return;
    const t = window.setTimeout(() => setStatus("idle"), STATUS_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  const copy = async () => {
    const link = `${window.location.origin}/rooms/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      const el = document.getElementById("invite-code-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setRevealed(true);
      setStatus("failed");
    }
  };

  return (
    <div className="flex min-h-11 items-center gap-1 rounded-sm border border-[var(--gold-edge)] bg-[var(--bg-surface)] pl-1 max-sm:justify-between">
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        aria-label={revealed ? "Ocultar código da sala" : "Mostrar código da sala"}
        data-revealed={revealed}
        className="group reticle flex min-h-9 items-center rounded-sm px-2 font-mono text-body uppercase tracking-wider text-[var(--ink)]"
      >
        <span
          aria-hidden
          data-testid="invite-code-mask"
          className="block group-hover:hidden group-focus-visible:hidden group-data-[revealed=true]:hidden"
        >
          {"*".repeat(code.length)}
        </span>
        <span
          aria-hidden
          data-testid="invite-code-visible"
          className="hidden group-hover:block group-focus-visible:block group-data-[revealed=true]:block"
        >
          {code}
        </span>
      </button>
      <span id="invite-code-text" className="sr-only">
        {code}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        aria-label="Copiar link de convite"
        className="-my-px -mr-px shrink-0"
      >
        {status === "copied" ? "Copiado" : status === "failed" ? "Copie" : "Copiar"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied"
          ? "Link de convite copiado"
          : status === "failed"
            ? "Não foi possível copiar. O código está selecionado, copie manualmente."
            : ""}
      </span>
    </div>
  );
});
