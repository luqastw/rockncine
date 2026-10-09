// @vitest-environment node
// Varredura de repositório: lê arquivos do disco, então roda no ambiente `node`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CODE_EXT = /\.(ts|tsx|css)$/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (CODE_EXT.test(entry)) out.push(full);
  }
  return out;
}

// Uma linha é "comentário" quando começa (ignorando indentação) com `//`, `*` ou
// `/*`. É preciso excluí-las porque `components/room/player/PlayerShell.tsx` cita
// `backdrop-filter` num comentário que explica justamente que ele NÃO existe mais
// naquela barra — o literal num comentário não é uso.
function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

const BLUR_RE = /backdrop-(?:filter|blur)/;

describe("blur isolado no chrome (FR-011)", () => {
  it("AC-008: 0 usos de backdrop-filter/backdrop-blur fora de components/chrome/**", () => {
    const infractores: string[] = [];
    for (const base of ["components/room", "app/rooms"]) {
      for (const file of walk(path.join(ROOT, base))) {
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (isCommentLine(line)) return;
            if (BLUR_RE.test(line)) infractores.push(`${path.relative(ROOT, file)}:${i + 1}`);
          });
      }
    }
    expect(infractores).toEqual([]);
  });
});

// Superfícies em escopo (spec 2.1, docs/specs/14-identidade-fanzine-crt/spec.md).
const SUPERFICIES = [
  "app/page.tsx",
  "app/login/page.tsx",
  "app/register/page.tsx",
  "app/rooms/page.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
];

describe("invólucro único (FR-018)", () => {
  it("AC-012: toda superfície em escopo importa PageShell e nenhuma tem <main> própria", () => {
    for (const rel of SUPERFICIES) {
      const src = readFileSync(path.join(ROOT, rel), "utf8");
      expect(src, `${rel} deve importar components/chrome/PageShell`).toMatch(
        /components\/chrome\/PageShell/,
      );
      // A largura da coluna morava no <main> de cada arquivo; agora é do shell.
      expect(src, `${rel} não pode renderizar <main>`).not.toMatch(/<main\b/);
    }
  });

  it("AC-014: o botão do global-error preserva a altura de toque", () => {
    const src = readFileSync(path.join(ROOT, "app/global-error.tsx"), "utf8");
    expect(src).toContain("min-h-11");
  });
});
