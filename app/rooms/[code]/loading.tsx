// A sala faz duas consultas no Postgres antes de renderizar (validação de
// sessão/membro no layout e o Room na page): sem este arquivo a navegação de
// /rooms pra dentro da sala não dava retorno visual nenhum (achado 23).
import { Fairy } from "@/components/chrome/Fairy";

export default function RoomLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col gap-5 px-4 pt-6 pb-14 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="h-3 w-40 rounded-full bg-[var(--fill-1)]" aria-hidden />
        <span className="h-3 w-24 rounded-full bg-[var(--fill-1)]" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-5 lg:flex-row">
        <div className="flex flex-col justify-safe-center lg:basis-[78%]">
          <div
            className="frame aspect-video w-full"
            aria-hidden
          />
        </div>
        <div className="flex w-full flex-col gap-3 lg:min-w-80 lg:basis-[22%]">
          <span className="h-11 rounded-sm bg-[var(--bg-surface)]" aria-hidden />
          <span className="min-h-40 flex-1 rounded-sm bg-[var(--bg-surface)]" aria-hidden />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Fairy className="size-12" />
        <p role="status" className="text-center text-caption text-[var(--ink-muted)]">
          Abrindo a sala…
        </p>
      </div>
    </main>
  );
}
