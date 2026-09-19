// @vitest-environment node
// Este teste lê o sistema de arquivos: precisa do ambiente `node`, e não do
// jsdom que o resto da suíte usa.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Guarda contra referência morta: o código cita as specs por caminho e por
// âncora textual (`docs/specs/02-.../spec.md, seção 9.1`, `achado 5`). Renumerar
// uma spec, mover um achado ou dividir um arquivo quebra essas citações em
// silêncio — foi o que aconteceu quando a spec 04 foi reescrita e os achados
// migraram para a 05 (vários comentários ficaram apontando para o número
// errado por meses).
//
// Este teste transforma isso em falha de build. Ele NÃO julga se a âncora
// aponta para o achado semanticamente certo — só se ela ainda existe onde o
// código diz que existe.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CODE_DIRS = ["app", "components", "hooks", "lib", "prisma"];
const CODE_EXT = /\.(ts|tsx)$/;

// O repo escreve a âncora nos dois sentidos:
//   `docs/specs/02-.../spec.md, seção 9.1`      (caminho primeiro)
//   `(achado 5, docs/specs/05-.../spec.md)`     (âncora primeiro)
// Então a âncora é procurada depois E antes do caminho.
const PATH_RE = /docs\/specs\/([a-z0-9-]+)\/((?:spec|tasks)\.md)/gi;
const ANCHOR_AT_START_RE = /^(seção|achado|item)\s+([\d./]+)/i;
// Distância máxima entre a âncora e o caminho para considerá-los ligados
// (cobre ", ", " de ", " da "). Sem isso, uma âncora solta na mesma linha
// seria atribuída ao caminho errado.
const MAX_ANCHOR_GAP = 24;

type Anchor = { kind?: string; anchor?: string };

function anchorAround(text: string, pathStart: number, pathEnd: number): Anchor {
  const after = text.slice(pathEnd).replace(/^[\s,]+/, "");
  const afterMatch = after.match(ANCHOR_AT_START_RE);
  if (afterMatch) return { kind: afterMatch[1].toLowerCase(), anchor: afterMatch[2] };

  const before = text.slice(0, pathStart);
  const matches = [...before.matchAll(/(seção|achado|item)\s+([\d./]+)/gi)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) return {};

  const gap = before.length - (last.index + last[0].length);
  if (gap > MAX_ANCHOR_GAP) return {};

  return { kind: last[1].toLowerCase(), anchor: last[2] };
}

type Reference = {
  file: string;
  line: number;
  specFolder: string;
  specFile: string;
  kind?: string;
  anchor?: string;
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full));
    } else if (CODE_EXT.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function collectReferences(): Reference[] {
  const refs: Reference[] = [];

  for (const dir of CODE_DIRS) {
    const base = path.join(ROOT, dir);
    let files: string[];
    try {
      files = walk(base);
    } catch {
      continue;
    }

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((text, index) => {
        for (const match of text.matchAll(PATH_RE)) {
          const start = match.index ?? 0;
          refs.push({
            file: path.relative(ROOT, file),
            line: index + 1,
            specFolder: match[1],
            specFile: match[2],
            ...anchorAround(text, start, start + match[0].length),
          });
        }
      });
    }
  }

  return refs;
}

const references = collectReferences();

describe("âncoras de docs/specs citadas pelo código", () => {
  it("encontra referências para validar (o coletor não pode estar quebrado)", () => {
    // Sem isto, um erro no walk/regex deixaria o teste verde por vacuidade.
    expect(references.length).toBeGreaterThanOrEqual(20);
    expect(references.some((ref) => ref.specFolder.startsWith("01-"))).toBe(true);
    expect(references.some((ref) => ref.kind === "achado")).toBe(true);
    expect(references.some((ref) => ref.kind === "seção")).toBe(true);
  });

  it("todo arquivo de spec citado existe", () => {
    const missing = references
      .filter((ref) => {
        const target = path.join(ROOT, "docs", "specs", ref.specFolder, ref.specFile);
        try {
          return !statSync(target).isFile();
        } catch {
          return true;
        }
      })
      .map((ref) => `${ref.file}:${ref.line} → docs/specs/${ref.specFolder}/${ref.specFile}`);

    expect(missing).toEqual([]);
  });

  it("toda âncora (seção / achado / item) citada ainda existe na spec", () => {
    const broken: string[] = [];

    for (const ref of references) {
      if (!ref.kind || !ref.anchor) continue;

      const target = path.join(ROOT, "docs", "specs", ref.specFolder, ref.specFile);
      let content: string;
      try {
        content = readFileSync(target, "utf8");
      } catch {
        continue; // já reprovado no teste de existência
      }

      // `seção 3/8` cita duas seções; `item 14.6` cita um item numerado.
      const values = ref.anchor.split("/").filter(Boolean);

      for (const value of values) {
        const found =
          ref.kind === "achado"
            ? // forma migrada (`achado 5`) ou a forma original (`**5. …**`)
              content.includes(`achado ${value}`) || content.includes(`**${value}.`)
            : content.includes(value);

        if (!found) {
          broken.push(
            `${ref.file}:${ref.line} → docs/specs/${ref.specFolder}/${ref.specFile} não contém "${ref.kind} ${value}"`,
          );
        }
      }
    }

    expect(broken).toEqual([]);
  });
});
