import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export const cardClass = "frame";

export const cardPrimaryClass = "frame [--frame-edge:var(--gold)]";

export const cardHoverClass =
  "frame-hover";

export function Card({
  className,
  tone = "plain",
  ...props
}: ComponentPropsWithoutRef<"div"> & { tone?: "plain" | "primary" }) {
  return <div className={cx(tone === "primary" ? cardPrimaryClass : cardClass, className)} {...props} />;
}
