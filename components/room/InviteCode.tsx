"use client";

import { useEffect, useState } from "react";

// O código da sala era só um <span> mono: não havia botão de copiar nem link
// de convite em lugar nenhum do app, e convidar alguém é o fluxo central de
// uma watch-party (achado 6 da auditoria). Copia a URL completa — o código
// curto (lib/room-code.ts) continua visível pra quem prefere ditar.
export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    const link = `${window.location.origin}/rooms/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // sem permissão de clipboard (http em rede local, permissão negada):
      // seleciona o código pra o usuário copiar à mão em vez de falhar mudo.
      const el = document.getElementById("invite-code-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
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
        {copied ? "link copiado" : "copiar convite"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "link de convite copiado" : ""}
      </span>
    </div>
  );
}
