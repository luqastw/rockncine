"use client";

import { useEffect, useState } from "react";

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_TIMEOUT_MS = 2000;

// O código da sala era só um <span> mono: não havia botão de copiar nem link
// de convite em lugar nenhum do app, e convidar alguém é o fluxo central de
// uma watch-party (achado 6 da auditoria). Copia a URL completa — o código
// curto (lib/room-code.ts) continua visível pra quem prefere ditar.
export function InviteCode({ code }: { code: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

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
      // Sem permissão de clipboard (http em rede local, permissão negada):
      // seleciona o código pra o usuário copiar à mão. Mas isto precisa ser
      // ANUNCIADO — antes o fallback era completamente mudo, o botão seguia
      // dizendo "copiar convite" e nem quem usa leitor de tela nem quem vê a
      // tela sabia que a cópia tinha falhado.
      const el = document.getElementById("invite-code-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setStatus("failed");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        id="invite-code-text"
        className="select-all font-mono text-sm tracking-wider text-[var(--ink-muted)]"
      >
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-3 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        {status === "copied" ? "link copiado" : status === "failed" ? "copie à mão" : "copiar convite"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied"
          ? "link de convite copiado"
          : status === "failed"
            ? "não foi possível copiar. o código está selecionado, copie manualmente."
            : ""}
      </span>
    </div>
  );
}
