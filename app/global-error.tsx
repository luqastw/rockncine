"use client";

import { useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { PageShell } from "@/components/chrome/PageShell";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Button } from "@/components/ui/Button";
import "./globals.css";

// Boundary de erro do documento inteiro. `app/error.tsx` cobre o segmento raiz,
// mas NÃO o próprio `layout.tsx` — falha ali (fonte, SessionProvider) caía na
// tela padrão do Next, fora da linguagem visual de todo o resto.
//
// Este arquivo SUBSTITUI o layout raiz, então precisa trazer o próprio
// `<html>`, o próprio `<body>`, o CSS global e as variáveis de fonte. As duas
// fontes da spec 15 são redeclaradas aqui pela mesma razão.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
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
    <html
      lang="pt-BR"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <title>alguma coisa quebrou · rockncine</title>
        <PageShell width="sm" className="items-center justify-center gap-4 text-center">
          <Wordmark />
          <span aria-hidden="true" className="h-px w-16 bg-[var(--hairline)]" />
          <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">
            alguma coisa quebrou
          </h1>
          <p className="text-body-sm text-[var(--ink-muted)]">
            não foi possível abrir o rockncine. tente de novo em alguns segundos.
          </p>
          <Button onClick={retry} className="min-h-11">
            tentar de novo
          </Button>
        </PageShell>
      </body>
    </html>
  );
}
