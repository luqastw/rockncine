import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <h1 className="text-2xl text-[var(--ink)]">página não encontrada</h1>
      <p className="text-sm text-[var(--ink-muted)]">esse link não existe.</p>
      <Link
        href="/"
        className="min-h-11 rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)] inline-flex items-center"
      >
        voltar
      </Link>
    </main>
  );
}
