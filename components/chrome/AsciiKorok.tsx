"use client";

import { useEffect, useState } from "react";

const TICK_MS = 200;

function blinking(tick: number): boolean {
  return tick % 20 < 2;
}

const HERO_WIDTH = 19;

function center(line: string): string {
  const total = HERO_WIDTH - line.length;
  const left = Math.max(0, Math.floor(total / 2));
  return " ".repeat(left) + line + " ".repeat(Math.max(0, total - left));
}

export function heroKorokFrame(tick: number): string {
  const berry = tick % 10 < 5 ? "o" : "*";
  const armL = tick % 14 < 7 ? "\\" : "|";
  const armR = tick % 14 < 7 ? "/" : "|";
  const eyes = blinking(tick) ? "-" : "o";
  const feet = tick % 8 < 4 ? "d b" : "b d";
  return [
    `${berry}      _/^\\_      ${berry}`,
    `${armL}    /=====\\    ${armR}`,
    ` \\  / / | \\ \\  /`,
    `  \\/ ${eyes}  V  ${eyes} \\/`,
    `   \\_  \\___/  _/`,
    `     \\__\\_|_/__/`,
    `        ${feet}`,
  ]
    .map(center)
    .join("\n");
}

export function miniKorokFrame(tick: number): string {
  const berry = tick % 10 < 5 ? "o" : "*";
  const eyes = blinking(tick) ? "-" : "o";
  return [
    ` ${berry}  /^\\  ${berry} `,
    ` |\\(${eyes} V ${eyes})/| `,
    `   \\_\\_/_/   `,
  ].join("\n");
}

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

  const frame = variant === "hero" ? heroKorokFrame(tick) : miniKorokFrame(tick);
  const size =
    variant === "hero" ? "text-[11px] leading-[12px]" : "text-[8px] leading-[9px]";

  return (
    <pre
      aria-hidden="true"
      className={`m-0 shrink-0 select-none whitespace-pre font-mono font-semibold text-[var(--accent)] ${size} ${className}`}
    >
      {frame}
    </pre>
  );
}
