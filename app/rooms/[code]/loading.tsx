// A sala faz duas consultas no Postgres antes de renderizar (validação de
// sessão/membro no layout e o Room na page): sem este arquivo a navegação de
// /rooms pra dentro da sala não dava retorno visual nenhum (achado 23).
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
            className="aspect-video w-full rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]"
            aria-hidden
          />
        </div>
        <div className="flex w-full flex-col gap-3 lg:min-w-80 lg:basis-[22%]">
          <span className="h-11 rounded-xl bg-[var(--bg-surface)]" aria-hidden />
          <span className="min-h-40 flex-1 rounded-xl bg-[var(--bg-surface)]" aria-hidden />
        </div>
      </div>
      <p role="status" className="sr-only">
        carregando a sala
      </p>
    </main>
  );
}
