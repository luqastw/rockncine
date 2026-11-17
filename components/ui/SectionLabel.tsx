import { cx } from "@/lib/cx";

export const sectionLabelClass =
  "border-b border-[var(--gold-edge)] pb-2 font-display text-heading font-semibold text-[var(--ink)]";

export function sectionLabel(className?: string): string {
  return cx(sectionLabelClass, className);
}
