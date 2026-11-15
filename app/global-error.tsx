"use client";

import { useEffect } from "react";
import { Inter, Geist_Mono, Fraunces } from "next/font/google";
import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Button } from "@/components/ui/Button";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: ["500", "600"],
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
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <title>alguma coisa quebrou · rockncine</title>
        <PageShell width="sm" className="items-center justify-center gap-6 text-center">
          <Wordmark />
          <Staff notes={3} className="mx-auto h-auto w-32" />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            alguma coisa quebrou
          </h1>
          <p className="text-body-sm text-[var(--ink-muted)]">algo travou aqui. tenta de novo.</p>
          <Button onClick={retry} className="min-h-11">
            tentar de novo
          </Button>
        </PageShell>
      </body>
    </html>
  );
}
