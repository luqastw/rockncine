// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_MS = 380;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function tsxFiles(bases: string[], includeTests: boolean): string[] {
  return bases
    .flatMap((base) => walk(path.join(ROOT, base)))
    .filter((f) => f.endsWith(".tsx") && (includeTests || !f.endsWith(".test.tsx")));
}

function rel(file: string): string {
  return path.relative(ROOT, file);
}

function scan(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${rel(file)}:${i + 1}`);
      });
  }
  return hits;
}

function toMs(value: number, unit: string): number {
  return unit === "s" ? value * 1000 : value;
}

const SOURCES = ["app", "components"];

describe("guardas do chrome", () => {
  it("AC-003: orçamento de ouro, no máximo 5 arquivos .tsx com --gold ou --torch", () => {
    const files = tsxFiles(SOURCES, false)
      .filter((f) => /--(gold|torch)/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(files, `arquivos com ouro: ${files.join(", ")}`).toSatisfy(
      (list: string[]) => list.length <= 5,
    );
  });

  it("AC-003: --heart só aparece em arquivos de erro ou ação destrutiva", () => {
    const permitidos = new Set([
      "error.tsx",
      "global-error.tsx",
      "not-found.tsx",
      "DeleteRoomButton.tsx",
      "ConfirmDialog.tsx",
      "LoginForm.tsx",
      "RegisterForm.tsx",
      "CreateRoomForm.tsx",
      "JoinRoomForm.tsx",
      "ProfileAvatarForm.tsx",
      "Input.tsx",
      "Button.tsx",
      "PlayerLoadStatus.tsx",
      "LoadVideoModal.tsx",
    ]);
    const fora = tsxFiles(SOURCES, false)
      .filter((f) => readFileSync(f, "utf8").includes("--heart"))
      .filter((f) => !permitidos.has(path.basename(f)))
      .map(rel);
    expect(fora).toEqual([]);
  });

  it("AC-004: nenhum resquício do cenário ASCII antigo", () => {
    const re = /AsciiKorok|AsciiLeaves|AsciiForest|KorokScene|AmbientGlow/;
    const files = SOURCES.flatMap((base) => walk(path.join(ROOT, base))).filter(
      (f) => /\.tsx?$/.test(f) && !f.endsWith("guards.test.ts"),
    );
    expect(scan(files, re)).toEqual([]);
    expect(readFileSync(path.join(ROOT, "app/globals.css"), "utf8")).not.toContain(".ambient");
  });

  it("AC-005: nenhum nome de franquia nos .tsx", () => {
    const re = /\b(zelda|navi|triforce|hyrule|kokiri|saria|korok|nintendo|ocarina)\b/i;
    expect(scan(tsxFiles(SOURCES, false), re)).toEqual([]);
  });

  describe("AC-020: movimento contido", () => {
    const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );

    it("globals.css não tem animação infinita", () => {
      expect(css).not.toMatch(/\binfinite\b/i);
    });

    it("globals.css limita durações a 380ms", () => {
      const over: string[] = [];
      const decl = /(animation|animation-duration|transition|transition-duration)\s*:([^;}]+)[;}]/g;
      for (const m of css.matchAll(decl)) {
        for (const t of m[2].matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)) {
          const ms = toMs(Number(t[1]), t[2]);
          if (ms > MAX_MS) over.push(`${m[1]}: ${t[0]}`);
        }
      }
      expect(over).toEqual([]);
    });

    it("prefers-reduced-motion zera animação e transição", () => {
      const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
      expect(start).toBeGreaterThanOrEqual(0);
      const open = css.indexOf("{", start);
      let depth = 0;
      let end = open;
      for (let i = open; i < css.length; i++) {
        if (css[i] === "{") depth++;
        if (css[i] === "}") depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
      const block = css.slice(open, end);
      expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/i);
      expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/i);
      expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/i);
    });

    it("tsx não usa animate-spin/pulse/bounce/ping", () => {
      expect(scan(tsxFiles(SOURCES, false), /\banimate-(spin|pulse|bounce|ping)\b/)).toEqual([]);
    });

    it("tsx não usa duração acima de 380ms", () => {
      const files = tsxFiles(SOURCES, false);
      const named = scan(files, /\bduration-(500|700|1000)\b/);
      const over: string[] = [];
      for (const file of files) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            for (const m of line.matchAll(/\bduration-\[(\d*\.?\d+)(ms|s)?\]/g)) {
              if (toMs(Number(m[1]), m[2] ?? "ms") > MAX_MS) over.push(`${rel(file)}:${i + 1}`);
            }
          });
      }
      expect([...named, ...over]).toEqual([]);
    });
  });

  it("AC-021: a sala não importa Fog", () => {
    const files = [
      ...walk(path.join(ROOT, "components/room")),
      ...walk(path.join(ROOT, "app/rooms/[code]")),
    ].filter((f) => /\.(ts|tsx)$/.test(f) && !/(not-found|error)\.tsx$/.test(f));
    const re = /from\s+["'][^"']*\/Fog["']|import\s+.*\bFog\b/;
    expect(scan(files, re)).toEqual([]);
  });
});
