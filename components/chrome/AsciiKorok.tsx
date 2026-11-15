"use client";

import { useEffect, useState } from "react";

const TICK_MS = 200;

function blinking(tick: number): boolean {
  return tick % 20 < 2;
}

const MIRROR: Record<string, string> = { "/": "\\", "\\": "/", d: "b", b: "d", "(": ")", ")": "(" };

function mirrored(half: string): string {
  return [...half].reverse().map((c) => MIRROR[c] ?? c).join("");
}

function row(left: string, center: string): string {
  return left + center + mirrored(left);
}

export function korokFrame(tick: number): string {
  const berry = tick % 10 < 5 ? "o" : "*";
  const eyes = blinking(tick) ? "-" : "o";
  const foot = tick % 8 < 4 ? "d" : "b";
  return [
    row("    ", "^"),
    row(" _ /", "|"),
    row(`\\_${eyes} `, "V"),
    row(`${berry}\\_|`, "="),
    row(`   ${foot}`, " "),
  ].join("\n");
}

export const miniKorokFrame = korokFrame;

export function AsciiKorok({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "mini";
  className?: string;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setTick((t) => t + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const frame = korokFrame(tick);
  const size =
    variant === "hero" ? "text-[14px] leading-[14px] tracking-[0.18em]" : "text-[8px] leading-[9px]";

  return (
    <pre
      aria-hidden="true"
      className={`m-0 shrink-0 select-none whitespace-pre font-mono font-semibold text-[var(--accent)] ${size} ${className}`}
    >
      {frame}
    </pre>
  );
}
