"use client";

import { useEffect, useRef } from "react";

const ACCENT = "61,223,174";
const GLYPHS = ["\\", "|", "/", "-"];
const FONT_PX = 12;
const BOX = FONT_PX + 6;

type Leaf = {
  x: number;
  y: number;
  vy: number;
  vx: number;
  phase: number;
  sway: number;
  spin: number;
  alpha: number;
  px: number;
  py: number;
};

type Settings = { areaPerLeaf: number; min: number; max: number; fps: number; alpha: number };

const SETTINGS: Record<"normal" | "low", Settings> = {
  normal: { areaPerLeaf: 90000, min: 8, max: 22, fps: 20, alpha: 0.7 },
  low: { areaPerLeaf: 200000, min: 4, max: 10, fps: 12, alpha: 0.5 },
};

export function AsciiLeaves({ density = "normal" }: { density?: "normal" | "low" }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    const cfg = SETTINGS[density];
    const frameMs = 1000 / cfg.fps;

    let w = 0;
    let h = 0;
    let leaves: Leaf[] = [];
    let raf = 0;
    let last = 0;

    const spawn = (anywhere: boolean): Leaf => {
      const x = Math.random() * w;
      const y = anywhere ? Math.random() * h : -BOX;
      return {
        x,
        y,
        vy: 16 + Math.random() * 24,
        vx: 2 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
        sway: 8 + Math.random() * 22,
        spin: 2 + Math.random() * 3,
        alpha: (0.25 + Math.random() * 0.45) * cfg.alpha,
        px: x,
        py: y,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      ctx.font = `600 ${FONT_PX}px ui-monospace, "Geist Mono", Menlo, monospace`;
      ctx.textBaseline = "top";
      const count = Math.min(cfg.max, Math.max(cfg.min, Math.round((w * h) / cfg.areaPerLeaf)));
      leaves = Array.from({ length: count }, () => spawn(true));
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < frameMs) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const l of leaves) ctx.clearRect(l.px - 2, l.py - 2, BOX, BOX);
      for (const l of leaves) {
        l.y += l.vy * dt;
        l.x += l.vx * dt;
        if (l.y > h) Object.assign(l, spawn(false));
        if (l.x > w) l.x = -BOX;
        const x = l.x + Math.sin(t * 0.8 + l.phase) * l.sway;
        const g = GLYPHS[Math.floor(t * l.spin + l.phase * 4) % GLYPHS.length];
        ctx.fillStyle = `rgba(${ACCENT},${l.alpha})`;
        ctx.fillText(g, x, l.y);
        l.px = x;
        l.py = l.y;
      }
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      if (document.hidden || document.fullscreenElement) return;
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const onMotion = () => {
      cancelAnimationFrame(raf);
      if (!reduced.matches) sync();
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    document.addEventListener("fullscreenchange", sync);
    reduced.addEventListener("change", onMotion);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("fullscreenchange", sync);
      reduced.removeEventListener("change", onMotion);
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 h-dvh w-full"
    />
  );
}
