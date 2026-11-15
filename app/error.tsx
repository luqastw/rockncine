"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SegmentError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(
      `erro na tela (digest: ${(error as Error & { digest?: string }).digest ?? "—"})`,
      error,
    );
  }, [error]);

  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Staff notes={3} className="mx-auto h-auto w-32" />
      <h1 className="font-display text-title font-semibold tracking-tight text-[var(--ink)]">
        alguma coisa quebrou
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">algo travou aqui. tenta de novo.</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>tentar de novo</Button>
        <ButtonLink href="/rooms" variant="outline">
          voltar pro menu
        </ButtonLink>
      </div>
    </PageShell>
  );
}
