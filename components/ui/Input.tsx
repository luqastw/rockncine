import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

type InputStyleOptions = {
  /** Troca a cor do halo de foco para o fundo de um painel. */
  surface?: boolean;
  className?: string;
};

const BASE =
  "min-h-11 w-full rounded-lg border border-[var(--ink-muted)] bg-[var(--fill-1)] px-3.5 py-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors duration-150 hover:border-[var(--ink)] focus:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 sm:text-body-sm";

export function inputClass({ surface = false, className }: InputStyleOptions = {}): string {
  return cx(
    BASE,
    surface
      ? "focus:ring-offset-[var(--bg-surface)]"
      : "focus:ring-offset-[var(--focus-offset)]",
    className,
  );
}

export function Input({
  surface,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & InputStyleOptions) {
  return <input className={inputClass({ surface, className })} {...props} />;
}

export function Textarea({
  surface,
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & InputStyleOptions) {
  return <textarea className={inputClass({ surface, className })} {...props} />;
}
