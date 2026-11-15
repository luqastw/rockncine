"use client";

import { useEffect, useState } from "react";

const TICK_MS = 180;

const HERO_LEAF = [" _\\|/_ ", " _-|-_ ", " _/|\\_ ", " _-|-_ "];
const MINI_LEAF = [" \\|/ ", " -|- ", " /|\\ ", " -|- "];

function blinking(tick: number): boolean {
  return tick % 22 < 2;
}

function heroFrame(tick: number): string {
  const leaf = HERO_LEAF[tick % HERO_LEAF.length];
  const eyes = blinking(tick) ? "( - - )" : "( o o )";
  const mouth = tick % 12 < 6 ? " \\_o_/ " : " \\_v_/ ";
  const feet = tick % 8 < 4 ? "  d b  " : "  b d  ";
  return [leaf, ".-\"\"\"-.", eyes, mouth, feet].join("\n");
}

function miniFrame(tick: number): string {
  const leaf = MINI_LEAF[tick % MINI_LEAF.length];
  const face = blinking(tick) ? "(-.-)" : "(o.o)";
  return [leaf, face, " /_\\ "].join("\n");
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

  const frame = variant === "hero" ? heroFrame(tick) : miniFrame(tick);
  const size =
    variant === "hero"
      ? "text-[13px] leading-[15px]"
      : "text-[8px] leading-[9px]";

  return (
    <pre
      aria-hidden="true"
      className={`m-0 shrink-0 select-none whitespace-pre font-mono font-semibold text-[var(--accent)] ${size} ${className}`}
    >
      {frame}
    </pre>
  );
}
