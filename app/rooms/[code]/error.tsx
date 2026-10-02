"use client";

// Boundary de erro do segmento `/rooms/[code]` — a SALA.
//
// Antes não havia boundary nenhum entre o layout da sala e o `app/error.tsx`
// da raiz. Um erro de render dentro de `RoomExperience` — que inclui o `Chat`,
// o `PresenceList` e todo o player — derrubava a tela inteira do participante,
// e a página de erro oferecia só "voltar pro menu": sumir com a sala sem meio
// de voltar.
//
// O erro mais provável na sala era exatamente o que a validação de payload
// corrige: um `{ text: {...} }` chegado por broadcast derrubava o React
// ("Objects are not valid as a React child") e cada participante perdia a
// tela. O boundary contém a falha; a validação (`lib/chat-event.ts`,
// `lib/playback/events.ts`) evita que ela chegue aqui.
//
// `retry` e não `reset`, conforme a doc desta versão
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`):
// `retry` re-busca e re-renderiza os filhos do boundary, `reset` só limpa o
// estado do erro sem re-buscar. A tela tem botão de recarga do player, storage
// do Liveblocks e snapshot de sala — tudo isso é servidor ou remoto, então
// re-buscar é o que recupera.

import { useEffect } from "react";
import Link from "next/link";

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
    <main className="mx-auto flex w-full min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
        a sala travou
      </h1>
      <p className="text-sm text-[var(--ink-muted)]">
        algo quebrou enquanto a sala estava aberta. você continua na sala — tente
        de novo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          tentar de novo
        </button>
        <Link
          href="/rooms"
          className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          suas salas
        </Link>
      </div>
    </main>
  );
}
