"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/chrome/PageShell";
import { Staff } from "@/components/chrome/Staff";
import { Wordmark } from "@/components/chrome/Wordmark";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function RoomSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(`erro na sala (digest: ${error.digest ?? "—"})`, error);
  }, [error]);

  return (
    <PageShell width="sm" fog className="items-center justify-center gap-6 text-center">
      <Wordmark />
      <Card className="flex flex-col items-center gap-6 p-6">
        <Staff notes={3} className="mx-auto h-auto w-32" />
        <h1 className="font-display text-title font-semibold tracking-tight text-[var(--heart)]">
          A sala travou
        </h1>
        <p className="text-body-sm text-[var(--ink-muted)]">Algo travou aqui. Tenta de novo.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => retry()}>Tentar de novo</Button>
          <ButtonLink href="/rooms" variant="outline">
            Suas salas
          </ButtonLink>
        </div>
      </Card>
    </PageShell>
  );
}
