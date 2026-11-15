"use client";

import { useEffect, useRef } from "react";

const ACCENT = "61,223,174";
const GLYPHS = ["\\", "|", "/", "-"];
const FONT_PX = 12;

type Leaf = { x: number; y: number; vy: number; phase: number; spin: number; alpha: number };

type Settings = { perSide: number; fps: number };

const SETTINGS: Record<"normal" | "low", Settings> = {
  normal: { perSide: 6, fps: 20 },
  low: { perSide: 3, fps: 12 },
};

export function AsciiLeaves({ density = "normal" }: { density?: "normal" | "low" }) {
  const left = useRef<HTMLCanvasElement | null>(null);
  const right = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvases = [left.current, right.current].filter(
      (c): c is HTMLCanvasElement => c !== null,
    );
    if (canvases.length === 0) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const { perSide, fps } = SETTINGS[density];
    const frameMs = 1000 / fps;

    const sides = canvases.map((canvas) => {
      const ctx = canvas.getContext("2d");
      return { canvas, ctx, w: 0, h: 0, leaves: [] as Leaf[] };
    });

    const spawn = (w: number, h: number, anywhere: boolean): Leaf => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -FONT_PX,
      vy: 18 + Math.random() * 22,
      phase: Math.random() * Math.PI * 2,
      spin: 2 + Math.random() * 3,
      alpha: 0.3 + Math.random() * 0.4,
    });

    const resize = () => {
      for (const side of sides) {
        const rect = side.canvas.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        side.w = rect.width;
        side.h = rect.height;
        side.canvas.width = Math.round(rect.width);
        side.canvas.height = Math.round(rect.height);
        side.leaves = Array.from({ length: perSide }, () => spawn(side.w, side.h, true));
      }
    };

    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < frameMs) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const side of sides) {
        const { ctx, w, h, leaves } = side;
        if (!ctx || w < 1) continue;
        ctx.clearRect(0, 0, w, h);
        ctx.font = `600 ${FONT_PX}px ui-monospace, "Geist Mono", Menlo, monospace`;
        ctx.textBaseline = "top";
        for (const l of leaves) {
          l.y += l.vy * dt;
          if (l.y > h) Object.assign(l, spawn(w, h, false));
          const x = l.x + Math.sin(t * 0.8 + l.phase) * Math.min(8, w * 0.3);
          const g = GLYPHS[Math.floor(t * l.spin + l.phase * 4) % GLYPHS.length];
          ctx.fillStyle = `rgba(${ACCENT},${l.alpha})`;
          ctx.fillText(g, Math.max(0, Math.min(w - FONT_PX * 0.6, x)), l.y);
        }
      }
    };

    const shouldRun = () => !document.hidden && !document.fullscreenElement;
    const sync = () => {
      cancelAnimationFrame(raf);
      if (!shouldRun()) return;
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const stopForMotion = () => {
      cancelAnimationFrame(raf);
      if (!reduced.matches) sync();
    };

    resize();
    const ro = new ResizeObserver(resize);
    sides.forEach((s) => ro.observe(s.canvas));
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("fullscreenchange", sync);
    reduced.addEventListener("change", stopForMotion);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("fullscreenchange", sync);
      reduced.removeEventListener("change", stopForMotion);
    };
  }, [density]);

  const strip =
    "pointer-events-none fixed top-0 -z-10 h-dvh w-[clamp(16px,3vw,56px)] max-sm:w-6 [mask-image:linear-gradient(to_bottom,transparent,#000_15%,#000_85%,transparent)]";

  return (
    <>
      <canvas ref={left} aria-hidden="true" className={`${strip} left-0`} />
      <canvas ref={right} aria-hidden="true" className={`${strip} right-0`} />
    </>
  );
}
