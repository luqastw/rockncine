const LINE_YS = [8, 16, 24, 32, 40];
const NOTE_YS = [32, 20, 28, 14, 24, 18];
const MIN_NOTES = 3;
const MAX_NOTES = 6;

type StaffProps = {
  notes?: number;
  lit?: boolean;
  className?: string;
};

export function Staff({ notes = 4, lit = false, className = "w-full h-auto" }: StaffProps) {
  const count = Math.min(MAX_NOTES, Math.max(MIN_NOTES, Math.round(notes)));
  const step = 240 / (count + 1);
  const color = lit ? "var(--fairy)" : "var(--leaf-ink)";

  return (
    <svg
      viewBox="0 0 240 48"
      aria-hidden="true"
      focusable="false"
      data-lit={lit ? "true" : "false"}
      className={className}
    >
      {LINE_YS.map((y) => (
        <line
          key={y}
          data-staff-line=""
          x1="0"
          x2="240"
          y1={y}
          y2={y}
          stroke="var(--line-strong)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: count }, (_, i) => {
        const x = step * (i + 1);
        const y = NOTE_YS[i];
        const stemDown = y < 24;
        const stemX = stemDown ? x - 4.6 : x + 4.6;
        const stemY1 = stemDown ? y + 1.6 : y - 1.6;
        const stemY2 = stemDown ? y + 20 : y - 20;
        return (
          <g
            key={i}
            data-staff-note=""
            fill={color}
            stroke={color}
            className="transition-[opacity,fill,stroke] duration-[380ms] motion-reduce:transition-none"
          >
            <ellipse
              cx={x}
              cy={y}
              rx="5"
              ry="3.6"
              transform={`rotate(-20 ${x} ${y})`}
              stroke="none"
            />
            <line x1={stemX} x2={stemX} y1={stemY1} y2={stemY2} strokeWidth="1.2" />
          </g>
        );
      })}
    </svg>
  );
}
