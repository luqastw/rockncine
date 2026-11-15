"use client";

import { useEffect, useRef } from "react";

const ACCENT = "47,191,143";
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

type Fly = { bx: number; by: number; phase: number; speed: number; px: number; py: number };

type Settings = { areaPerLeaf: number; min: number; max: number; fps: number; alpha: number; flies: number };

const SETTINGS: Record<"normal" | "low", Settings> = {
  normal: { areaPerLeaf: 260000, min: 3, max: 8, fps: 20, alpha: 0.6, flies: 5 },
  low: { areaPerLeaf: 420000, min: 2, max: 4, fps: 12, alpha: 0.45, flies: 3 },
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
    let flies: Fly[] = [];
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
      flies = Array.from({ length: cfg.flies }, () => ({
        bx: Math.random() * w,
        by: h * (0.25 + Math.random() * 0.6),
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.35,
        px: 0,
        py: 0,
      }));
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < frameMs) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      for (const l of leaves) ctx.clearRect(l.px - 2, l.py - 2, BOX, BOX);
      for (const f of flies) ctx.clearRect(f.px - 4, f.py - 4, BOX + 4, BOX + 4);
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
      for (const f of flies) {
        const x = f.bx + Math.sin(t * f.speed + f.phase) * 60 + Math.sin(t * f.speed * 2.3) * 14;
        const y = f.by + Math.cos(t * f.speed * 0.8 + f.phase) * 36;
        const a = (0.15 + 0.85 * Math.max(0, Math.sin(t * 1.4 + f.phase * 3))) * cfg.alpha;
        ctx.fillStyle = `rgba(${ACCENT},${a * 0.35})`;
        ctx.fillText("\u00b7", x - 5, y);
        ctx.fillText("\u00b7", x + 5, y);
        ctx.fillStyle = `rgba(${ACCENT},${a})`;
        ctx.fillText("*", x, y);
        f.px = x;
        f.py = y;
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
