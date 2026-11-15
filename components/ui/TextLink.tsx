import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

const textLinkClass =
  "rounded-sm text-[var(--ink)] underline decoration-[var(--ink-muted)] underline-offset-4 hover:decoration-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]";

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cx(textLinkClass, className)} {...props} />;
}
