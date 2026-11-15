import { cx } from "@/lib/cx";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 12 14"
        className="h-5 w-[1.0625rem] shrink-0"
        fill="var(--torch)"
      >
        <ellipse cx="4" cy="10.5" rx="3.4" ry="2.4" transform="rotate(-20 4 10.5)" />
        <rect x="6.6" y="1" width="1.4" height="9.5" />
      </svg>
      <span className="font-display text-heading font-semibold tracking-tight text-[var(--ink)]">
        rockncine
      </span>
    </span>
  );
}
