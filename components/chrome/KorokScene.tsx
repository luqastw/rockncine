"use client";

import { row } from "./AsciiKorok";

export type KorokPose = "dormindo" | "perdido" | "caido";

const POSES: Record<KorokPose, string[]> = {
  dormindo: [
    "         z",
    "        z ",
    row("    ", "^"),
    row(" _ /", "|"),
    row("\\_- ", "V"),
    row("o\\_|", "="),
    row("  __", "_"),
  ],
  perdido: [
    "         ?",
    row("    ", "^"),
    row(" _ /", "|"),
    row("\\_o ", "V"),
    row("o\\_|", "="),
    row("   d", " "),
    "    . . .  ",
  ],
  caido: [
    row("    ", "^"),
    row(" _ /", "|"),
    row("\\_x ", "V"),
    row("o\\_|", "="),
    row("  d ", " "),
    "  ~ ~ ~ ~  ",
  ],
};

export function KorokScene({ pose, className = "" }: { pose: KorokPose; className?: string }) {
  return (
    <pre
      aria-hidden="true"
      className={`m-0 shrink-0 select-none whitespace-pre font-mono text-[12px] font-semibold leading-[13px] tracking-[0.18em] text-[var(--accent)] ${className}`}
    >
      {POSES[pose].join("\n")}
    </pre>
  );
}
