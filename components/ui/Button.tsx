import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "outline" | "soft" | "ghost";
export type ButtonSize = "md" | "sm";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  surface?: boolean;
  className?: string;
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-body font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline-strong)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--leaf)] text-[var(--bg-void)] shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:bg-[var(--leaf-ink)]",
  outline:
    "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:border-[var(--line-strong)]",
  soft: "bg-[var(--fill-1)] text-[var(--ink)] hover:bg-[var(--fill-2)]",
  ghost: "text-[var(--ink-muted)] hover:bg-[var(--fill-1)] hover:text-[var(--ink)]",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5",
  sm: "px-3.5",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  surface = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cx(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    surface
      ? "focus-visible:ring-offset-[var(--bg-surface)]"
      : "focus-visible:ring-offset-[var(--focus-offset)]",
    className,
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & ButtonStyleOptions;

export function Button({
  variant,
  size,
  surface,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, surface, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & ButtonStyleOptions;

export function ButtonLink({
  variant,
  size,
  surface,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, size, surface, className })} {...props} />;
}
