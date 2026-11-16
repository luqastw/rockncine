// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL("../ui/", import.meta.url));
const raiz = fileURLToPath(new URL("../../", import.meta.url));

function tsx(base: string): string[] {
  return readdirSync(base, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = base + entrada.name;
    if (entrada.isDirectory()) return tsx(caminho + "/");
    if (!entrada.name.endsWith(".tsx")) return [];
    if (entrada.name.endsWith(".test.tsx")) return [];
    return [caminho];
  });
}

describe("primitivos de components/ui", () => {
  it("AC-006: nenhum primitivo usa ring de foco", () => {
    const arquivos = readdirSync(dir).filter((nome) => nome.endsWith(".tsx"));
    expect(arquivos.length).toBeGreaterThan(0);
    const infratores = arquivos.filter((nome) =>
      /focus(-visible)?:ring/.test(readFileSync(dir + nome, "utf8")),
    );
    expect(infratores).toEqual([]);
  });

  it("AC-006: nenhum .tsx usa outline de foco nem peer-focus-visible:outline", () => {
    const arquivos = [...tsx(raiz + "app/"), ...tsx(raiz + "components/")];
    const infratores = arquivos
      .filter((caminho) => /(peer-)?focus(-visible)?:outline/.test(readFileSync(caminho, "utf8")))
      .map((caminho) => caminho.slice(raiz.length));
    expect(infratores).toEqual([]);
  });

  it("AC-006: nenhum .tsx usa ring de foco", () => {
    const arquivos = [...tsx(raiz + "app/"), ...tsx(raiz + "components/")];
    expect(arquivos.length).toBeGreaterThan(0);
    const infratores = arquivos
      .filter((caminho) =>
        /focus(-visible)?:ring|ring-offset/.test(readFileSync(caminho, "utf8")),
      )
      .map((caminho) => caminho.slice(raiz.length));
    expect(infratores).toEqual([]);
  });
});
