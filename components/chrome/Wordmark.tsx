import { cx } from "@/lib/cx";
import { AsciiKorok } from "./AsciiKorok";

// Wordmark no gradiente prateado da hero da Kimi (FR-007,
// docs/specs/15-identidade-kimi/spec.md). O texto é real e acessível; só o
// ponto à esquerda é decorativo. Nenhum asset ou logotipo da Kimi é usado.
export function Wordmark({ className, korok = false }: { className?: string; korok?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      {korok ? (
        <AsciiKorok variant="mini" />
      ) : (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      )}
      <span className="font-display text-body-sm font-semibold tracking-tight text-[var(--ink)]">
        rockncine
      </span>
    </span>
  );
}
