"use client";

import { useEffect, useRef } from "react";
import { clamp, fbm, rng } from "@/lib/ascii-noise";
import { miniKorokFrame } from "./AsciiKorok";

const FONT_PX = 12;
const FRAME_MS = 1000 / 24;
const ACCENT = "47,191,143";
const KOROK_WIDTH = 10;
const RIPPLE_LIFE = 2.4;
const RIPPLE_REACH = 90;

type Ripple = { x: number; t0: number };
type Fly = { bx: number; by: number; phase: number; speed: number };

export function AsciiForest({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let cols = 0;
    let rows = 0;
    let cw = 7;
    let ch = 14;
    let korokCol = 0;
    let jit: number[] = [];
    let flies: Fly[] = [];
    let ripples: Ripple[] = [];
    let nextDrop = 3;
    let raf = 0;
    let last = 0;
    let visible = true;
    const rand = rng(11);

    const gust = (x: number, t: number) => fbm(x * 0.035 - t * 0.55, t * 0.05, 3, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `600 ${FONT_PX}px ui-monospace, "Geist Mono", Menlo, monospace`;
      ctx.textBaseline = "top";
      cw = ctx.measureText("M").width;
      ch = Math.round(FONT_PX * 1.15);
      cols = Math.max(10, Math.floor(rect.width / cw));
      rows = Math.max(6, Math.floor(rect.height / ch));
      korokCol = Math.max(2, Math.floor((cols - KOROK_WIDTH) / 2));
      jit = Array.from({ length: cols + 8 }, () => rand());
      flies = Array.from({ length: 6 }, () => ({
        bx: rand() * cols,
        by: rows * (0.1 + rand() * 0.35),
        phase: rand() * 6.28,
        speed: 0.3 + rand() * 0.4,
      }));
      draw(performance.now() / 1000);
    };

    const drawGrass = (t: number) => {
      const ground = rows - 1;
      for (let x = 0; x < cols; x++) {
        const j = jit[x];
        if (j < 0.06) continue;
        const underKorok = x >= korokCol - 1 && x <= korokCol + KOROK_WIDTH;
        const h = underKorok ? 1 : 2 + j * 3.6;
        const g = gust(x, t);
        const bend = (g - 0.35) * 2.6 + Math.sin(t * 2.3 + x * 0.4) * 0.12;
        for (let k = 1; k <= h; k++) {
          const u = k / h;
          const off = bend * u * u * h * 0.9;
          const slope = bend * 2 * u * 0.9;
          const glyph =
            k >= h - 0.5 && j > 0.8 ? "'" : slope > 0.55 ? "/" : slope < -0.45 ? "\\" : slope > 0.25 ? ")" : "|";
          const lum = clamp(u * 0.5 + (g - 0.4) * 1.1 + 0.15);
          ctx.fillStyle = `rgba(${ACCENT},${0.18 + lum * 0.6})`;
          ctx.fillText(glyph, (x + off) * cw, (ground - k + 1) * ch);
        }
      }
    };

    const drawRipples = (t: number) => {
      const cy = (rows - 1) * ch + ch * 0.5;
      ripples = ripples.filter((r) => t - r.t0 < RIPPLE_LIFE);
      for (const r of ripples) {
        const age = (t - r.t0) / RIPPLE_LIFE;
        for (const ring of [0, 0.22]) {
          const p = age - ring;
          if (p <= 0) continue;
          const radius = p * RIPPLE_REACH;
          const alpha = (1 - p) * 0.7;
          if (alpha <= 0) continue;
          ctx.fillStyle = `rgba(${ACCENT},${alpha})`;
          const n = Math.max(10, Math.round(radius / 3));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const px = r.x * cw + Math.cos(a) * radius;
            const py = cy + Math.sin(a) * radius * 0.28;
            if (px < 0 || px > cols * cw) continue;
            ctx.fillText(Math.abs(Math.sin(a)) > 0.6 ? "-" : "~", px, py);
          }
        }
      }
    };

    const drawFlies = (t: number) => {
      for (const f of flies) {
        const x = f.bx + Math.sin(t * f.speed + f.phase) * 5 + Math.sin(t * f.speed * 2.3) * 1.5;
        const y = f.by + Math.cos(t * f.speed * 0.8 + f.phase) * 1.4;
        const a = 0.2 + 0.8 * Math.max(0, Math.sin(t * 1.4 + f.phase * 3));
        ctx.fillStyle = `rgba(${ACCENT},${a * 0.3})`;
        ctx.fillText("·", (x - 1) * cw, y * ch);
        ctx.fillText("·", (x + 1) * cw, y * ch);
        ctx.fillStyle = `rgba(${ACCENT},${a})`;
        ctx.fillText("*", x * cw, y * ch);
      }
    };

    const drawKorok = (t: number) => {
      const blink = Math.floor(t * 5) % 20 < 2;
      const lines = (blink ? miniKorokFrame(0) : miniKorokFrame(2)).split("\n");
      ctx.fillStyle = `rgb(${ACCENT})`;
      lines.forEach((line, i) => ctx.fillText(line, korokCol * cw, (rows - 1 - lines.length + i) * ch));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `600 ${FONT_PX}px ui-monospace, "Geist Mono", Menlo, monospace`;
      ctx.textBaseline = "top";
      if (!reduced.matches && t >= nextDrop) {
        ripples.push({ x: 4 + rand() * (cols - 8), t0: t });
        nextDrop = t + 5 + rand() * 4;
      }
      drawGrass(t);
      drawKorok(t);
      drawRipples(t);
      drawFlies(t);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now / 1000);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      if (!visible || reduced.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({ x: (e.clientX - rect.left) / cw, t0: performance.now() / 1000 });
      if (ripples.length > 6) ripples.shift();
      if (reduced.matches) draw(performance.now() / 1000);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", schedule);
    reduced.addEventListener("change", schedule);
    canvas.addEventListener("pointerdown", onPointer);
    resize();
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`block w-full [mask-image:linear-gradient(to_right,transparent,#000_14%,#000_86%,transparent)] ${className}`}
    />
  );
}
