import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export const cardClass = "frame";

export const cardPrimaryClass = "frame [--line:rgb(95_158_79/0.4)]";

export const cardHoverClass =
  "transition-colors duration-150 hover:bg-[var(--bg-elevated)]";

export function Card({
  className,
  tone = "plain",
  ...props
}: ComponentPropsWithoutRef<"div"> & { tone?: "plain" | "primary" }) {
  return <div className={cx(tone === "primary" ? cardPrimaryClass : cardClass, className)} {...props} />;
}
