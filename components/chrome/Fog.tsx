type FogProps = {
  className?: string;
};

export function Fog({ className = "" }: FogProps) {
  return (
    <div
      aria-hidden="true"
      data-fog=""
      data-motif="fog"
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-0 ${className}`.trim()}
    >
      <svg
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
        focusable="false"
        aria-hidden="true"
        className="block h-40 w-full"
      >
        <path
          d="M0 90 C150 50 300 130 450 90 S750 40 900 90 S1100 120 1200 80 V160 H0 Z"
          fill="var(--ink)"
          fillOpacity="0.03"
        />
        <path
          d="M0 110 C200 70 350 140 600 105 S950 70 1200 115 V160 H0 Z"
          fill="var(--ink)"
          fillOpacity="0.05"
        />
        <path
          d="M0 130 C180 105 400 150 620 128 S980 105 1200 132 V160 H0 Z"
          fill="var(--ink)"
          fillOpacity="0.07"
        />
      </svg>
    </div>
  );
}
