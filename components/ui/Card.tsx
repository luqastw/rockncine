import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export const cardClass = "rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]";

export const cardHoverClass =
  "transition-colors duration-150 hover:border-[var(--ink-muted)] hover:bg-[var(--fill-1)]";

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cx(cardClass, className)} {...props} />;
}
