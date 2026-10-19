import { cx } from "@/lib/cx";

export const sectionLabelClass =
  "font-mono text-caption uppercase tracking-wide text-[var(--ink-muted)]";

export function sectionLabel(className?: string): string {
  return cx(sectionLabelClass, className);
}
