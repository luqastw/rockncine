import { cx } from "@/lib/cx";

export function Silhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-motif="silhouette"
      className={cx("text-[var(--gold)]", className)}
    >
      <g stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.2">
        <path d="M200 10 390 200 200 390 10 200Z" />
        <path d="M200 50 350 200 200 350 50 200Z" />
        <path d="M200 90 310 200 200 310 90 200Z" />
        <path d="M200 10V390M10 200H390" strokeOpacity="0.1" />
      </g>
      <path
        d="M200 96c52 16 84 58 84 108 0 52-34 90-84 100-50-10-84-48-84-100 0-50 32-92 84-108Z"
        fill="currentColor"
        fillOpacity="0.09"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.4"
      />
      <path
        d="M200 112v196M200 160l-38-28M200 160l38-28M200 206l-48-34M200 206l48-34M200 252l-40-28M200 252l40-28"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardNumeral({ value }: { value: string }) {
  return (
    <span
      aria-hidden="true"
      className="font-display text-[5rem] leading-none font-semibold text-gold sm:text-[6.5rem]"
    >
      {value}
    </span>
  );
}
