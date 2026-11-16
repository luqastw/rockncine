// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

function block(start: string): string {
  const from = css.indexOf(start);
  expect(from, `${start} existe`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", from); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") depth--;
    if (depth === 0) return css.slice(from, i + 1);
  }
  return "";
}

describe("íris (FR-020, FR-021)", () => {
  it("AC-014: íris usa só transform e opacity e ≤ 380ms", () => {
    const frames = block("@keyframes iris-open");
    const props = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) expect(["transform", "opacity"]).toContain(prop);

    const iris = block(".iris {");
    expect(iris).not.toContain("clip-path");
    const mult = iris.match(/animation:[^;]*calc\(var\(--motion-dur\) \* var\(--motion-factor\) \* ([\d.]+)\)/);
    expect(mult, "duração em função de --motion-dur").toBeTruthy();
    const factor = Number(mult?.[1]);
    const dur = Number(css.match(/--motion-dur:\s*(\d+)ms/)?.[1]);
    expect(dur).toBeLessThanOrEqual(200);
    expect(factor).toBeLessThanOrEqual(1.9);
    expect(dur * factor).toBeLessThanOrEqual(380);
  });

  it("AC-014: reduced-motion desliga a íris por CSS e a camada é reduzida", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.iris \{\s*display: none;/i);
    expect(css).toMatch(/\.reduce-motion \.iris \{\s*display: none;/i);
    const iris = block(".iris {");
    expect(iris).toContain("width: 100vmax");
    expect(iris).toContain("margin: -50vmax 0 0 -50vmax");
    expect(iris).toContain("will-change: transform");
    expect(block("@keyframes iris-open")).toContain("scale(36)");
  });
});
