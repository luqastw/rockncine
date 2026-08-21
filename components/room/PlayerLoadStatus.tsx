"use client";

import { useEffect, useState } from "react";

const TIMEOUT_MS = 8000;

// Cobre o caso "embed bloqueado" quando a fonte tem player controlável
// (YouTube/Vimeo) — ver SPEC.md seção 7. Sem onError confiável nesses SDKs
// pra esse cenário específico (bloqueador de anúncio/rastreamento derruba o
// iframe/script silenciosamente), então usamos um timeout: se o player não
// ficar pronto a tempo, mostramos aviso + link pro vídeo original.
export function PlayerLoadStatus({
  loading,
  sourceUrl,
}: {
  loading: boolean;
  sourceUrl: string | null;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-[var(--ink-muted)]">
      {timedOut ? (
        <div className="flex flex-col items-center gap-2">
          <span>não foi possível carregar o player.</span>
          <span className="text-xs">
            se você usa bloqueador de anúncios/rastreamento, tente liberar este site.
          </span>
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
