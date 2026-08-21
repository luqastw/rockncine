"use client";

import Link from "next/link";

// Sem este arquivo, qualquer erro no servidor (Postgres fora do ar, por
// exemplo) caía na tela de erro default do Next, fora da linguagem visual do
// resto do app (achado 23). Mesmo padrão dos not-found já estilizados.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
        alguma coisa quebrou
      </h1>
      <p className="text-sm text-[var(--ink-muted)]">
        não foi possível carregar esta tela. tente de novo em alguns segundos.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          tentar de novo
        </button>
        <Link
          href="/rooms"
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          voltar pro menu
        </Link>
      </div>
    </main>
  );
}
