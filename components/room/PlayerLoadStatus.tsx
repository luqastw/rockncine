"use client";

import { useEffect, useState } from "react";
import { isSafeEmbedUrl } from "@/lib/video-source";

const TIMEOUT_MS = 8000;

// Cobre o caso "embed bloqueado" quando a fonte tem player controlável
// (YouTube/Vimeo) — ver docs/specs/01-fundacao-mvp/spec.md, seção 7. Quando o SDK reporta um erro
// explícito (ex.: vídeo com restrição de idade) mostramos na hora; senão,
// timeout genérico cobre falhas silenciosas (bloqueador de anúncio/rede).
export function PlayerLoadStatus({
  loading,
  error,
  sourceUrl,
}: {
  loading: boolean;
  error: string | null;
  sourceUrl: string | null;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading || error) return;
    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loading, error]);

  // `!loading` sozinho escondia o overlay assim que o backend reportava
  // `isReady` — erro emitido depois disso (autoplay bloqueado, embed
  // restrito reportado só após `onReady`) nunca chegava a aparecer (achado 3,
  // docs/specs/04-auditoria-ui-ux-rodada-2/spec.md). `error` mantém o overlay vivo independente do
  // estado de `loading`.
  if (!loading && !error) return null;

  const message = error ?? (timedOut ? "não foi possível carregar o player." : null);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--scrim)] px-4 text-center text-sm text-[var(--ink-muted)]">
      {message ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-md border-2 border-[var(--ink)] bg-[var(--bg-void)] px-3 py-2"
        >
          <span className="font-semibold text-[var(--ink)]">{message}</span>
          {!error && (
            <span className="text-xs text-[var(--ink-muted)]">
              se você usa bloqueador de anúncios/rastreamento, tente liberar este site.
            </span>
          )}
          {sourceUrl && isSafeEmbedUrl(sourceUrl) && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-sm text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
            >
              abrir o link original
            </a>
          )}
        </div>
      ) : (
        "carregando player..."
      )}
    </div>
  );
}
