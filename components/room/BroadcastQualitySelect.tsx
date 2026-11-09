import { useBroadcastQuality } from "@/hooks/useBroadcastQuality";
import {
  BROADCAST_QUALITIES,
  BROADCAST_QUALITY_LEVELS,
  broadcastQuality,
  type BroadcastQualityLevel,
} from "@/lib/broadcast-quality";

export function BroadcastQualitySelect({ disabled }: { disabled: boolean }) {
  const { level, setQuality } = useBroadcastQuality();
  const quality = broadcastQuality(level);

  return (
    <label
      className={`hidden items-center gap-1 text-caption sm:flex ${
        disabled ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"
      }`}
    >
      <span className="sr-only sm:not-sr-only">qualidade</span>
      <select
        value={level}
        disabled={disabled}
        onChange={(event) => setQuality(event.target.value as BroadcastQualityLevel)}
        aria-label={
          disabled
            ? "a qualidade só muda na próxima transmissão"
            : `qualidade da transmissão: ${quality.detail}`
        }
        className="min-h-11 rounded-lg border border-[var(--ink-muted)] bg-[var(--fill-1)] px-2 py-1 text-caption text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--ink-muted)]"
      >
        {BROADCAST_QUALITY_LEVELS.map((item) => (
          <option key={item} value={item}>
            {BROADCAST_QUALITIES[item].label}
          </option>
        ))}
      </select>
    </label>
  );
}
