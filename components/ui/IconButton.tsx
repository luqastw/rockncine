import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type IconButtonVariant = "ghost" | "outline";

type IconButtonStyleOptions = {
  variant?: IconButtonVariant;
  active?: boolean;
  surface?: boolean;
  className?: string;
};

const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "text-[var(--ink-muted)] hover:bg-[var(--fill-1)] hover:text-[var(--ink)]",
  outline:
    "border border-[var(--ink-muted)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--fill-1)]",
};

export function iconButtonClass({
  variant = "outline",
  active = false,
  surface = false,
  className,
}: IconButtonStyleOptions = {}): string {
  return cx(
    BASE,
    active
      ? "border border-[var(--ink)] bg-[var(--fill-2)] text-[var(--ink)]"
      : VARIANTS[variant],
    surface
      ? "focus:ring-offset-[var(--bg-surface)]"
      : "focus:ring-offset-[var(--focus-offset)]",
    className,
  );
}

type IconButtonProps = ComponentPropsWithoutRef<"button"> & IconButtonStyleOptions;

export function IconButton({
  variant,
  active,
  surface,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={iconButtonClass({ variant, active, surface, className })}
      {...props}
    />
  );
}
