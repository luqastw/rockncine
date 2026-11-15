"use client";

import { useEffect, useRef } from "react";
import { miniKorokFrame } from "./AsciiKorok";

const FONT_PX = 12;
const FRAME_MS = 1000 / 24;
const ACCENT = "61,223,174";
const TRUNK = "#1f4a33";
const CANOPY = ["#12281d", "#16301f", "#1c3f2b"];
const GRASS = "#2c5a43";
const LEAF_GLYPHS = ["\\", "|", "/", "-"];
const CANOPY_GLYPHS = ["%", "&", "8", "#", "@"];
const GRASS_GLYPHS = ["\"", "'", ";", ",", "|"];

type Cell = { ch: string; color: string; canopy: boolean };

type Leaf = { x: number; y: number; vy: number; phase: number; spin: number; alpha: number };
type Fly = { x: number; y: number; phase: number; speed: number };

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScene(cols: number, rows: number): (Cell | null)[] {
  const rand = mulberry(7);
  const grid: (Cell | null)[] = new Array(cols * rows).fill(null);
  const set = (x: number, y: number, cell: Cell) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    grid[y * cols + x] = cell;
  };
  const ground = rows - 1;
  for (let x = 0; x < cols; x++) {
    set(x, ground, { ch: GRASS_GLYPHS[Math.floor(rand() * GRASS_GLYPHS.length)], color: GRASS, canopy: false });
    if (rand() < 0.35) {
      set(x, ground - 1, { ch: GRASS_GLYPHS[Math.floor(rand() * GRASS_GLYPHS.length)], color: GRASS, canopy: false });
    }
  }
  const spacing = 15;
  for (let cx = 6; cx < cols - 3; cx += spacing + Math.floor(rand() * 6)) {
    const trunkH = Math.max(3, Math.floor(rows * 0.45) + Math.floor(rand() * 2));
    const top = ground - trunkH;
    for (let y = top; y < ground; y++) {
      set(cx, y, { ch: "|", color: TRUNK, canopy: false });
      set(cx + 1, y, { ch: "|", color: TRUNK, canopy: false });
    }
    const rx = 6 + Math.floor(rand() * 3);
    const ry = Math.max(2, Math.floor(rows * 0.32));
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        if (d > 1 || rand() < 0.12) continue;
        set(cx + dx, top + dy, {
          ch: CANOPY_GLYPHS[Math.floor(rand() * CANOPY_GLYPHS.length)],
          color: CANOPY[Math.floor(rand() * CANOPY.length)],
          canopy: true,
        });
      }
    }
  }
  return grid;
}

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
    let scene: (Cell | null)[] = [];
    let leaves: Leaf[] = [];
    let flies: Fly[] = [];
    let raf = 0;
    let last = 0;
    let visible = true;
    let pointer: { x: number; y: number } | null = null;
    const rand = mulberry(11);
    const korokLines = miniKorokFrame(2).split("\n");
    let korokCol = 0;

    const spawnLeaf = (anywhere: boolean): Leaf => ({
      x: rand() * cols,
      y: anywhere ? rand() * rows : -1 - rand() * 3,
      vy: 0.9 + rand() * 1.2,
      phase: rand() * Math.PI * 2,
      spin: 3 + rand() * 4,
      alpha: 0.45 + rand() * 0.5,
    });

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
      rows = Math.max(5, Math.floor(rect.height / ch));
      scene = buildScene(cols, rows);
      korokCol = Math.max(2, Math.floor(cols * 0.62));
      const count = Math.max(6, Math.round(cols / 7));
      leaves = Array.from({ length: count }, () => spawnLeaf(true));
      flies = Array.from({ length: 5 }, () => ({
        x: rand() * cols,
        y: rows * (0.2 + rand() * 0.5),
        phase: rand() * 6.28,
        speed: 0.4 + rand() * 0.5,
      }));
      draw(performance.now() / 1000, 0);
    };

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `600 ${FONT_PX}px ui-monospace, "Geist Mono", Menlo, monospace`;
      ctx.textBaseline = "top";

      for (let k = -2; k < cols / 12 + 2; k++) {
        const pulse = 0.05 + 0.05 * Math.sin(t * 0.5 + k);
        ctx.fillStyle = `rgba(${ACCENT},${pulse})`;
        for (let y = 0; y < rows - 1; y++) {
          const x = Math.round(k * 12 + 4 + y * 1.4 + Math.sin(t * 0.2 + k) * 2);
          if (x < 0 || x >= cols) continue;
          ctx.fillText("/", x * cw, y * ch);
        }
      }

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = scene[y * cols + x];
          if (!cell) continue;
          let glyph = cell.ch;
          if (cell.canopy) {
            const n = Math.sin(t * 0.8 + x * 0.35 + y * 0.6);
            if (n > 0.55) glyph = CANOPY_GLYPHS[(x + y) % CANOPY_GLYPHS.length];
          }
          ctx.fillStyle = cell.color;
          ctx.fillText(glyph, x * cw, y * ch);
        }
      }

      const blink = Math.floor(t * 5) % 20 < 2;
      const korok = blink ? miniKorokFrame(2).replaceAll("o V o", "- V -").split("\n") : korokLines;
      ctx.fillStyle = `rgb(${ACCENT})`;
      korok.forEach((line, i) => {
        ctx.fillText(line, korokCol * cw, (rows - 4 + i) * ch);
      });

      for (const f of flies) {
        f.phase += dt * f.speed;
        const fx = f.x + Math.sin(f.phase * 1.3) * 3;
        const fy = f.y + Math.cos(f.phase) * 1.2;
        const a = 0.3 + 0.7 * Math.max(0, Math.sin(f.phase * 2.1));
        ctx.fillStyle = `rgba(${ACCENT},${a})`;
        ctx.fillText("*", fx * cw, fy * ch);
      }

      for (const l of leaves) {
        l.y += l.vy * dt;
        l.x += (Math.sin(t * 0.7 + l.phase) * 1.4 + 0.5) * dt;
        if (pointer) {
          const dx = l.x * cw - pointer.x;
          const dy = l.y * ch - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 4900) l.x += (dx / (Math.sqrt(d2) + 1)) * dt * 14;
        }
        if (l.y > rows - 1 || l.x > cols + 2) Object.assign(l, spawnLeaf(false));
        if (l.x < -2) l.x = cols + 1;
        const g = LEAF_GLYPHS[Math.floor(t * l.spin + l.phase * 4) % LEAF_GLYPHS.length];
        ctx.fillStyle = `rgba(${ACCENT},${l.alpha})`;
        ctx.fillText(g, l.x * cw, l.y * ch);
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      draw(now / 1000, dt);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      if (!visible || reduced.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer = null;
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
    canvas.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    resize();
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", schedule);
      reduced.removeEventListener("change", schedule);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`block w-full [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)] ${className}`}
    />
  );
}
