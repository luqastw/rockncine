import type { ComponentPropsWithoutRef } from "react";
import { cx } from "@/lib/cx";

type InputStyleOptions = {
  surface?: boolean;
  className?: string;
};

const BASE =
  "min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--bg-void)] px-3.5 py-2 text-body text-[var(--ink)] placeholder:text-[var(--ink-muted)] transition-colors duration-150 hover:border-[var(--ink-muted)] focus-visible:border-[var(--fairy)] field-ring";

export function inputClass({ surface = false, className }: InputStyleOptions = {}): string {
  return cx(
    BASE,
    surface && "bg-[var(--bg-elevated)]",
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
