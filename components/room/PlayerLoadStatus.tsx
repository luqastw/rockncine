"use client";

import { useEffect, useState } from "react";

const TIMEOUT_MS = 8000;

// Cobre o caso "embed bloqueado" quando a fonte tem player controlável
// (YouTube/Vimeo) — ver SPEC.md seção 7. Quando o SDK reporta um erro
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

  if (!loading) return null;

  const message = error ?? (timedOut ? "não foi possível carregar o player." : null);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-[var(--ink-muted)]">
      {message ? (
        <div className="flex flex-col items-center gap-2">
          <span>{message}</span>
          {!error && (
            <span className="text-xs">
              se você usa bloqueador de anúncios/rastreamento, tente liberar este site.
            </span>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--ember)] hover:underline"
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
