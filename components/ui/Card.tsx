import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export const cardClass = "rounded-md border border-[var(--line)] bg-[var(--bg-surface)]";

export const cardPrimaryClass = "rounded-md border border-[var(--leaf)]/40 bg-[var(--bg-surface)]";

export const cardHoverClass =
  "transition-colors duration-150 hover:bg-[var(--bg-elevated)]";

export function Card({
  className,
  tone = "plain",
  ...props
}: ComponentPropsWithoutRef<"div"> & { tone?: "plain" | "primary" }) {
  return <div className={cx(tone === "primary" ? cardPrimaryClass : cardClass, className)} {...props} />;
}
