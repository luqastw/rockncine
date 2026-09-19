"use client";

import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

// Boundary de erro do documento inteiro. `app/error.tsx` cobre o segmento raiz,
// mas NÃO o próprio `layout.tsx` (o boundary de um segmento não envolve o layout
// dele) — falha ali (fonte, SessionProvider) caía na tela padrão do Next, fora
// da linguagem visual de todo o resto (achado 7 da revisão de design).
//
// Duas diferenças obrigatórias em relação ao `error.tsx`, as duas vindas da doc
// desta versão (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`):
//   1. este arquivo SUBSTITUI o layout raiz, então precisa trazer o próprio
//      `<html>`, o próprio `<body>`, o CSS global e as variáveis de fonte —
//      nada disso é herdado;
//   2. `metadata`/`generateMetadata` não existem aqui (é client component): o
//      título vai por `<title>` do React.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  // `retry` (e não `reset`, que o `error.tsx` usa): a doc recomenda `retry`
  // quando o que falhou foi a busca no servidor — `reset` só limpa o boundary e
  // re-renderiza o mesmo erro. Aqui o caso típico é o banco fora do ar.
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(`erro global (digest: ${error.digest ?? "—"})`, error);
  }, [error]);

  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <title>alguma coisa quebrou · rockncine</title>
        <main className="animate-rise mx-auto flex w-full min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            alguma coisa quebrou
          </h1>
          <p className="text-sm text-[var(--ink-muted)]">
            não foi possível abrir o rockncine. tente de novo em alguns segundos.
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
