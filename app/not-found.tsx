import Link from "next/link";
import { PageShell } from "@/components/chrome/PageShell";
import { AsciiArt } from "@/components/chrome/AsciiArt";
import { NOT_FOUND_ART } from "@/components/chrome/ascii";

// Estado de 404 com a mesma linguagem do resto (FR-019,
// docs/specs/14-identidade-fanzine-crt/spec.md): fio, arte ASCII decorativa e
// Display mono. Sem `ChromeBar` — os três estados de 404/erro compartilham a
// mesma linha de marca em `font-display`, para a linguagem não divergir. A marca
// e o texto do estado vivem fora da arte (FR-009).
export default function NotFound() {
  return (
    <PageShell width="sm" className="items-center justify-center gap-4 text-center">
      <AsciiArt art={NOT_FOUND_ART} />
      {/* fio de separação (FR-012/FR-019): um hairline, jamais só o desfoque */}
      <span aria-hidden="true" className="h-px w-16 bg-[var(--hairline)]" />
      <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        rockncine
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
        página não encontrada
      </h1>
      <p className="text-sm text-[var(--ink-muted)]">esse link não existe.</p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        voltar
      </Link>
    </PageShell>
  );
}
