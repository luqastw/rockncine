"use client";

import { memo, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type CopyStatus = "idle" | "copied" | "failed";

const STATUS_TIMEOUT_MS = 2000;

// O código da sala era só um <span> mono: não havia botão de copiar nem link
// de convite em lugar nenhum do app, e convidar alguém é o fluxo central de
// uma watch-party (achado 6 da auditoria). Copia a URL completa — o código
// curto (lib/room-code.ts) continua visível pra quem prefere ditar.
// `memo` porque a prop é uma string imutável: evento de presença ou de sync na
// sala não tem por que redesenhar o botão de convidar (FR-010,
// docs/specs/13-chat-sala/spec.md).
export const InviteCode = memo(function InviteCode({ code }: { code: string }) {
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
    <div className="flex items-center gap-1 rounded-lg bg-[var(--fill-1)] py-1 pl-3 pr-1">
      <span
        id="invite-code-text"
        className="select-all font-mono text-body-sm tracking-wider text-[var(--ink-muted)]"
      >
        {code}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={copy} className="shrink-0">
        {status === "copied" ? "link copiado" : status === "failed" ? "copie à mão" : "copiar convite"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied"
          ? "link de convite copiado"
          : status === "failed"
            ? "não foi possível copiar. o código está selecionado, copie manualmente."
            : ""}
      </span>
    </div>
  );
});
