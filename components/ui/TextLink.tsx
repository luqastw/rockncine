import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";

const textLinkClass =
  "inline-flex min-h-11 items-center rounded-sm text-[var(--gold-hi)] underline decoration-[var(--gold-lo)] underline-offset-4 transition-[text-decoration-color] duration-300 hover:decoration-[var(--gold-hi)] reticle";

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cx(textLinkClass, className)} {...props} />;
}
