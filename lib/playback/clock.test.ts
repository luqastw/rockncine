import { describe, expect, it } from "vitest";
import { MAX_SKEW_MS, SKEW_TTL_MS, skewFor, updateSkew, type SkewSamples } from "./clock";

// `at` é o instante local em que a amostra foi aceita (`localReceipt`).
const skew = (value: number, at = 1_000) => ({ skew: value, at });

// Relógio local adiantado em relação a quem age aparece como skew NEGATIVO —
// é o caso comum, não um valor a descartar.
describe("updateSkew com ator adiantado", () => {
  it("aceita a primeira amostra negativa do ator", () => {
    expect(updateSkew({}, "b", 1_000, 4_000)).toEqual({ b: skew(-3_000, 4_000) });
  });

  it("mantém a maior (menos negativa) entre amostras negativas", () => {
    let samples = updateSkew({}, "b", 1_000, 4_000); // -3000
    samples = updateSkew(samples, "b", 3_900, 4_000); // -100, menos latência
    expect(samples.b?.skew).toBe(-100);
  });
});

describe("updateSkew", () => {
  it("registra a primeira amostra de um ator", () => {
    expect(updateSkew({}, "a", 5_000, 4_000)).toEqual({ a: skew(1_000, 4_000) });
  });

  // ts - recebidoEm = skew - latência. Como latência >= 0, cada amostra é uma
  // cota inferior do skew real, e a maior delas é a de menor latência.
  it("mantém a MAIOR amostra, não a última", () => {
    let samples = updateSkew({}, "a", 5_000, 4_000); // skew aparente 1000
    samples = updateSkew(samples, "a", 5_500, 5_000); // 500 (mais latência)
    expect(samples.a?.skew).toBe(1_000);

    samples = updateSkew(samples, "a", 6_400, 5_000); // 1400 (menos latência)
    expect(samples.a?.skew).toBe(1_400);
  });

  it("isola a estimativa por ator", () => {
    let samples = updateSkew({}, "a", 5_000, 4_000);
    samples = updateSkew(samples, "b", 1_000, 4_000);
    expect(samples.a?.skew).toBe(1_000);
    expect(samples.b?.skew).toBe(-3_000);
    expect(samples.a?.at).toBe(4_000);
  });

  it("não muta o objeto recebido", () => {
    const original: SkewSamples = { a: skew(1_000) };
    const next = updateSkew(original, "a", 9_000, 4_000);
    expect(original.a?.skew).toBe(1_000);
    expect(next).not.toBe(original);
  });

  it("ignora amostras não finitas", () => {
    const samples: SkewSamples = { a: skew(1_000) };
    expect(updateSkew(samples, "a", Number.NaN, 4_000)).toBe(samples);
    expect(updateSkew(samples, "a", 5_000, Number.NaN)).toBe(samples);
  });

  // Um `ts` absurdo (cliente malicioso, relógio saltando) inflaria o desvio e
  // empurraria a correção para muito além do fim do vídeo.
  it("descarta desvio absurdo acima do teto sanitário", () => {
    const samples: SkewSamples = { a: skew(1_000) };
    const tooFar = MAX_SKEW_MS + 1;
    expect(updateSkew(samples, "a", 4_000 + tooFar, 4_000)).toBe(samples);
    expect(updateSkew(samples, "a", 4_000 - tooFar, 4_000)).toBe(samples);
  });

  // O teto tem que ser o mesmo do parser de evento, senão um `ts` passa pela
  // validação de formato e morre só aqui — ou pior, passa pelos dois e a
  // correção de drift recebe 4 minutos de deslocamento de um evento forjado.
  it("o teto de desvio é da mesma ordem do teto de plausibilidade do ts", () => {
    expect(MAX_SKEW_MS).toBe(30_000);
  });

  // A maior-amostra é um estimador que não converge: se o relógio do ator se
  // sincroniza, as amostras novas ficam perto de 0 e a antiga continuaria
  // valendo para sempre.
  it("uma amostra vencida perde a autoridade para a próxima", () => {
    let samples = updateSkew({}, "a", 9_000, 4_000); // skew 5000
    expect(samples.a?.skew).toBe(5_000);

    const muitoDepois = 4_000 + SKEW_TTL_MS + 1;
    // skew aparente 100, muito MENOR que 5000 — aceito porque a amostra
    // antiga já não vale nada.
    samples = updateSkew(samples, "a", muitoDepois + 100, muitoDepois);
    expect(samples.a?.skew).toBe(100);
  });

  it("mantém a maior amostra dentro da janela de validade", () => {
    let samples = updateSkew({}, "a", 9_000, 4_000); // skew 5000
    const dentroDaJanela = 4_000 + SKEW_TTL_MS - 1;
    samples = updateSkew(samples, "a", dentroDaJanela + 100, dentroDaJanela);
    expect(samples.a?.skew).toBe(5_000);
  });
});

describe("skewFor", () => {
  it("devolve a estimativa do ator", () => {
    expect(skewFor({ a: skew(1_000) }, "a", 1_000)).toBe(1_000);
  });

  // Sem amostra, o comportamento é o de antes da compensação existir — a
  // correção nunca piora por falta de dado.
  it("devolve 0 para ator desconhecido, string vazia ou nulo", () => {
    const samples: SkewSamples = { a: skew(1_000) };
    expect(skewFor(samples, "b", 1_000)).toBe(0);
    expect(skewFor(samples, "", 1_000)).toBe(0);
    expect(skewFor(samples, null, 1_000)).toBe(0);
    expect(skewFor(samples, undefined, 1_000)).toBe(0);
  });

  it("devolve 0 para amostra vencida, mesmo com o ator presente", () => {
    const samples: SkewSamples = { a: skew(240_000) };
    expect(skewFor(samples, "a", 1_000 + SKEW_TTL_MS + 1)).toBe(0);
    expect(skewFor(samples, "a", 1_000 + SKEW_TTL_MS)).toBe(240_000);
  });
});
