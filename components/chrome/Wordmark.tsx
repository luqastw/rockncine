import { cx } from "@/lib/cx";

// Wordmark no gradiente prateado da hero da Kimi (FR-007,
// docs/specs/15-identidade-kimi/spec.md). O texto é real e acessível; só o
// ponto à esquerda é decorativo. Nenhum asset ou logotipo da Kimi é usado.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--ink)]" />
      <span className="bg-gradient-to-r from-[#b3b3b3] via-white to-[#8f8f8f] bg-clip-text font-display text-body-sm font-semibold tracking-tight text-transparent">
        rockncine
      </span>
    </span>
  );
}
