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

// A barra de controles do player é a única superfície fora do chrome que pode
// usar desfoque: ela é um overlay de 12px sobre o vídeo, e o fundo translúcido
// é o que mantém os controles legíveis sem esconder o quadro. A allowlist é
// explícita — um segundo arquivo entrando aqui deve ser uma decisão revisada.
const BLUR_ALLOWED = new Set(["components/room/player/PlayerControls.tsx"]);

describe("blur isolado no chrome (FR-005)", () => {
  it("AC-005: 0 usos de backdrop-filter/backdrop-blur fora do chrome e da barra do player", () => {
    const infractores: string[] = [];
    for (const base of ["components/room", "app/rooms"]) {
      for (const file of walk(path.join(ROOT, base))) {
        const rel = path.relative(ROOT, file);
        if (BLUR_ALLOWED.has(rel)) continue;
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (isCommentLine(line)) return;
            if (BLUR_RE.test(line)) infractores.push(`${rel}:${i + 1}`);
          });
      }
    }
    expect(infractores).toEqual([]);
  });
});

// Superfícies em escopo (FR-008, docs/specs/15-identidade-kimi/spec.md).
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
