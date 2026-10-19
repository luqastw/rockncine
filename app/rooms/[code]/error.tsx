"use client";

// Boundary de erro do segmento `/rooms/[code]` — a SALA.
//
// Antes não havia boundary nenhum entre o layout da sala e o `app/error.tsx`
// da raiz. Um erro de render dentro de `RoomExperience` — que inclui o `Chat`,
// o `PresenceList` e todo o player — derrubava a tela inteira do participante,
// e a página de erro oferecia só "voltar pro menu": sumir com a sala sem meio
// de voltar.
//
// `retry` e não `reset`, conforme a doc desta versão
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`):
// `retry` re-busca e re-renderiza os filhos do boundary, `reset` só limpa o
// estado do erro sem re-buscar. A tela tem botão de recarga do player, storage
// do Liveblocks e snapshot de sala — tudo isso é servidor ou remoto, então
// re-buscar é o que recupera.

import { useEffect } from "react";
import { PageShell } from "@/components/chrome/PageShell";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function RoomSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // O `digest` é o que o Next expõe do lado do servidor e o que correlaciona a
  // tela com o log. Sem ele, nenhum 500 em produção deixa rastro.
  useEffect(() => {
    console.error(`erro na sala (digest: ${error.digest ?? "—"})`, error);
  }, [error]);

  return (
    <PageShell width="sm" className="items-center justify-center gap-4 text-center">
      <h1 className="text-title font-semibold tracking-tight text-[var(--ink)]">
        a sala travou
      </h1>
      <p className="text-body-sm text-[var(--ink-muted)]">
        algo quebrou enquanto a sala estava aberta. você continua na sala — tente
        de novo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => retry()}>tentar de novo</Button>
        <ButtonLink href="/rooms" variant="outline">
          suas salas
        </ButtonLink>
      </div>
    </PageShell>
  );
}
