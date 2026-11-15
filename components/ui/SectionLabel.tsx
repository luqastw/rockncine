import { cx } from "@/lib/cx";

export const sectionLabelClass =
  "text-caption font-medium text-[var(--ink-muted)]";

export function sectionLabel(className?: string): string {
  return cx(sectionLabelClass, className);
}
