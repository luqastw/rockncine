type StumpProps = {
  className?: string;
};

export function Stump({ className = "size-16" }: StumpProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      data-motif="stump"
      focusable="false"
      fill="none"
      stroke="var(--line-strong)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 24 V46 C16 50 12 54 6 58 M16 50 C20 53 24 56 26 58 M48 24 V46 C48 50 52 54 58 58 M48 50 C44 53 40 56 38 58 M26 58 C29 56 35 56 38 58" fill="var(--bg-elevated)" />
      <ellipse cx="32" cy="24" rx="16" ry="7" fill="var(--bg-elevated)" />
      <ellipse cx="32" cy="24" rx="11" ry="4.6" />
      <ellipse cx="32" cy="24" rx="6" ry="2.4" />
      <path d="M32 24 h0.01" />
    </svg>
  );
}
