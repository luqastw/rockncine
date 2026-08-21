import Link from "next/link";

export default function RoomNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-2xl text-[var(--ink)]">sala não encontrada</h1>
      <p className="text-sm text-[var(--ink-muted)]">
        esse código não corresponde a nenhuma sala ativa. confira se digitou certo.
      </p>
      <Link
        href="/rooms"
        className="min-h-11 rounded-md bg-[var(--ember)] px-4 py-2 text-sm font-medium text-[var(--bg-void)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)] inline-flex items-center"
      >
        voltar pro menu
      </Link>
    </main>
  );
}
