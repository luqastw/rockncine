import Image from "next/image";
import { cx } from "@/lib/cx";

export function Wordmark({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/brand/mark.png"
        alt=""
        width={32}
        height={32}
        unoptimized
        aria-hidden="true"
        className="size-8 shrink-0"
      />
      {markOnly ? null : (
        <span className="font-display text-heading font-semibold tracking-tight text-[var(--ink)]">
          Rockncine
        </span>
      )}
    </span>
  );
}
