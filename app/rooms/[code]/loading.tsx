// A sala faz duas consultas no Postgres antes de renderizar (validação de
// sessão/membro no layout e o Room na page): sem este arquivo a navegação de
// /rooms pra dentro da sala não dava retorno visual nenhum (achado 23).
export default function RoomLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1800px] flex-col gap-6 px-6 pt-8 pb-14">
      <div className="flex items-center gap-3">
        <span className="h-3 w-40 rounded-full bg-[var(--line)]" aria-hidden />
        <span className="h-3 w-24 rounded-full bg-[var(--line)]" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <div className="lg:basis-[80%]">
          <div
            className="aspect-video w-full rounded-md border border-[var(--line)] bg-[var(--bg-surface)]"
            aria-hidden
          />
        </div>
        <div className="flex w-full flex-col gap-3 lg:min-w-72 lg:basis-[20%]">
          <span className="h-11 rounded-md bg-[var(--bg-surface)]" aria-hidden />
          <span className="min-h-40 flex-1 rounded-md bg-[var(--bg-surface)]" aria-hidden />
        </div>
      </div>
      <p role="status" className="sr-only">
        carregando a sala
      </p>
    </main>
  );
}
