import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type BadgeVariant = "solid" | "soft" | "outline";

const VARIANTS: Record<BadgeVariant, string> = {
  solid: "bg-[var(--invert-bg)] text-[var(--invert-fg)]",
  soft: "bg-[var(--fill-1)] text-[var(--ink-muted)]",
  outline: "border border-[var(--line)] text-[var(--ink-muted)]",
};

export function Badge({
  variant = "soft",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
