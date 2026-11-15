import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export const cardClass = "rounded-xl border border-[var(--line)] bg-[var(--bg-surface)]";

export const cardPrimaryClass = "rounded-xl border border-[var(--accent)]/35 bg-[var(--fill-1)]";

export const cardHoverClass =
  "transition-colors duration-150 hover:border-[var(--ink-muted)] hover:bg-[var(--fill-1)]";

export function Card({
  className,
  tone = "plain",
  ...props
}: ComponentPropsWithoutRef<"div"> & { tone?: "plain" | "primary" }) {
  return <div className={cx(tone === "primary" ? cardPrimaryClass : cardClass, className)} {...props} />;
}
