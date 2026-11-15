import { cx } from "@/lib/cx";

export const sectionLabelClass =
  "border-b-[3px] border-double border-[var(--line)] pb-2 font-display text-heading font-semibold text-[var(--ink)]";

export function sectionLabel(className?: string): string {
  return cx(sectionLabelClass, className);
}
