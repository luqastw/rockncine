import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

export type IconButtonVariant = "ghost" | "outline";

type IconButtonStyleOptions = {
  variant?: IconButtonVariant;
  active?: boolean;
  className?: string;
};

const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 btn-round reticle transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "text-[var(--ink-muted)] hover:bg-[var(--fill-1)] hover:text-[var(--ink)]",
  outline:
    "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:border-[var(--line-strong)]",
};

export function iconButtonClass({
  variant = "outline",
  active = false,
  className,
}: IconButtonStyleOptions = {}): string {
  return cx(
    BASE,
    active
      ? "border border-[var(--leaf)] bg-[var(--fill-2)] text-[var(--ink)]"
      : VARIANTS[variant],
    className,
  );
}

type IconButtonProps = ComponentPropsWithoutRef<"button"> & IconButtonStyleOptions;

export function IconButton({
  variant,
  active,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={iconButtonClass({ variant, active, className })}
      {...props}
    />
  );
}
