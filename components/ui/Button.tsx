import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "outline" | "soft" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-body font-medium transition-colors duration-150 reticle disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "frame-btn reticle-on-leaf bg-[var(--leaf)] text-[var(--bg-void)] hover:bg-[var(--leaf-ink)]",
  outline:
    "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:border-[var(--line-strong)]",
  soft: "bg-[var(--fill-1)] text-[var(--ink)] hover:bg-[var(--fill-2)]",
  ghost: "text-[var(--ink-muted)] hover:bg-[var(--fill-1)] hover:text-[var(--ink)]",
  danger:
    "border border-[var(--heart)] bg-transparent text-[var(--heart)] hover:bg-[var(--fill-1)]",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5",
  sm: "px-3.5",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], className);
}

function variantAttr(variant: ButtonVariant = "primary"): ButtonVariant | undefined {
  return variant === "primary" ? variant : undefined;
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & ButtonStyleOptions;

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variantAttr(variant)}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & ButtonStyleOptions;

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-variant={variantAttr(variant)}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
