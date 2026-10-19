"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Button, ButtonLink } from "@/components/ui/Button";

// Boundary de erro do segmento raiz. Não envolve o `layout.tsx` acima dele —
// a falha no próprio layout raiz é coberta por `app/global-error.tsx`, que
// substitui o layout inteiro.
//
// A linguagem é a da spec 15: wordmark, fio, título sans e controles
// primitivos. Sem `Reveal` de propósito: num erro, o conteúdo tem de aparecer
// sem depender do IntersectionObserver.
export default function SegmentError({ error, reset }: { error: Error; reset: () => void }) {
  // O `digest` é o que o Next expõe do lado do servidor e é o que correlaciona
  // a tela com o log — sem ele não há como investigar o ocorrido.
  useEffect(() => {
    console.error(
      `erro na tela (digest: ${(error as Error & { digest?: string }).digest ?? "—"})`,
      error,
    );
  }, [error]);

  return (
    <PageShell width="sm" className="items-center justify-center gap-4 text-center">
      <Wordmark />
      <span aria-hidden="true" className="h-px w-16 bg-[var(--hairline)]" />
      <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">
        alguma coisa quebrou
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">
        não foi possível carregar esta tela. tente de novo em alguns segundos.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>tentar de novo</Button>
        <ButtonLink href="/rooms" variant="outline">
          voltar pro menu
        </ButtonLink>
      </div>
    </PageShell>
  );
}
