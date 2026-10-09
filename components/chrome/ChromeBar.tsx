import Link from "next/link";

// Barra fixa de chrome com a marca em Display mono (FR-006/FR-012/FR-019,
// docs/specs/14-identidade-fanzine-crt/spec.md). É o único consumidor da classe
// `.chrome-blur` (FR-011): o desfoque e o fio `--hairline` ficam isolados em
// components/chrome/** para nunca chegarem perto do player (AC-008).
//
// Sem "use client": é server component e só usa `next/link`.
export function ChromeBar({ width = "md" }: { width?: "sm" | "md" }) {
  return (
    <header className="chrome-blur fixed inset-x-0 top-0 z-30 flex justify-center">
      {/* A largura acompanha a do PageShell (FR-018): a marca não pode ficar
          desalinhada da coluna de conteúdo nas telas `sm`. */}
      <div
        className={[
          "flex w-full items-center px-6 py-2",
          width === "md" ? "max-w-md" : "max-w-sm",
        ].join(" ")}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-sm font-display text-sm font-semibold tracking-tight text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          rockncine
        </Link>
      </div>
    </header>
  );
}
