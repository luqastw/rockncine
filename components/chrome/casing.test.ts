// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");
const PASTAS = ["app", "components", "hooks", "lib"];
const MINUSCULA = "[a-zà-ú]";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    if (!/\.tsx?$/.test(nome) || /\.test\./.test(nome) || nome.endsWith(".d.ts")) return [];
    return [caminho];
  });
}

function ehComentario(linha: string) {
  return /^\s*(\/\/|\*|\/\*)/.test(linha);
}

function achados() {
  const saida: string[] = [];
  const atributo = new RegExp(`(?:aria-label|placeholder|title|alt|label|confirmLabel|busyLabel)=\\{?"(${MINUSCULA}[^"]*)"`);
  const mensagem = new RegExp(`(?:setError|error:|title:|label:|return)\\s*\\(?"(${MINUSCULA}[^"]*\\s[^"]*)"`);
  const texto = new RegExp(`^\\s+([←→]\\s)?(${MINUSCULA}[a-zà-ú0-9,.!?…·()-]*[ .!?…,][A-Za-zà-ú0-9 ,.!?…·(){}-]*)$`);
  for (const pasta of PASTAS) {
    for (const arquivo of arquivos(join(RAIZ, pasta))) {
      const linhas = readFileSync(arquivo, "utf8").split("\n");
      linhas.forEach((linha, i) => {
        if (ehComentario(linha)) return;
        const rel = `${relative(RAIZ, arquivo)}:${i + 1}`;
        const a = atributo.exec(linha) ?? mensagem.exec(linha);
        if (a) saida.push(`${rel} ${a[1]}`);
        const anterior = (linhas[i - 1] ?? "").trimEnd();
        const t = texto.exec(linha);
        if (t && /[>}]$/.test(anterior) && !/^\s*(return|if|else|const|let)\b/.test(linha)) {
          saida.push(`${rel} ${t[2]}`);
        }
      });
    }
  }
  return saida;
}

describe("capitalização do texto visível", () => {
  it("nenhum texto de interface começa em minúscula", () => {
    expect(achados()).toEqual([]);
  });
});
