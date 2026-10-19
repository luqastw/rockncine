import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "outline" | "soft" | "ghost";
export type ButtonSize = "md" | "sm";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Troca a cor do halo de foco para o fundo de um painel. */
  surface?: boolean;
  className?: string;
};

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-body-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[var(--invert-bg)] text-[var(--invert-fg)] shadow-[var(--shadow-xs)] hover:opacity-90",
  outline:
    "border border-[var(--ink-muted)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--fill-1)]",
  soft: "bg-[var(--fill-1)] text-[var(--ink)] hover:bg-[var(--fill-2)]",
  ghost:
    "text-[var(--ink-muted)] hover:bg-[var(--fill-1)] hover:text-[var(--ink)]",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-4 py-2",
  sm: "px-3 py-1.5 text-body-sm",
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
      ? "focus:ring-offset-[var(--bg-surface)]"
      : "focus:ring-offset-[var(--focus-offset)]",
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
