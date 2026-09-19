import { describe, expect, it } from "vitest";
import { skewFor, updateSkew } from "./clock";

describe("updateSkew", () => {
  it("registra a primeira amostra de um ator", () => {
    expect(updateSkew({}, "a", 5_000, 4_000)).toEqual({ a: 1_000 });
  });

  // ts - recebidoEm = skew - latência. Como latência >= 0, cada amostra é uma
  // cota inferior do skew real, e a maior delas é a de menor latência.
  it("mantém a MAIOR amostra, não a última", () => {
    let samples = updateSkew({}, "a", 5_000, 4_000); // skew aparente 1000
    samples = updateSkew(samples, "a", 5_500, 5_000); // 500 (mais latência)
    expect(samples.a).toBe(1_000);

    samples = updateSkew(samples, "a", 6_400, 5_000); // 1400 (menos latência)
    expect(samples.a).toBe(1_400);
  });

  it("isola a estimativa por ator", () => {
    let samples = updateSkew({}, "a", 5_000, 4_000);
    samples = updateSkew(samples, "b", 1_000, 4_000);
    expect(samples).toEqual({ a: 1_000, b: -3_000 });
  });

  it("não muta o objeto recebido", () => {
    const original = { a: 1_000 };
    const next = updateSkew(original, "a", 9_000, 4_000);
    expect(original).toEqual({ a: 1_000 });
    expect(next).not.toBe(original);
  });

  it("ignora amostras não finitas", () => {
    const samples = { a: 1_000 };
    expect(updateSkew(samples, "a", Number.NaN, 4_000)).toBe(samples);
    expect(updateSkew(samples, "a", 5_000, Number.NaN)).toBe(samples);
  });

  // Um `ts` absurdo (cliente malicioso, relógio saltando) inflaria o desvio e
  // empurraria a correção para muito além do fim do vídeo.
  it("descarta desvio absurdo acima do teto sanitário", () => {
    const samples = { a: 1_000 };
    expect(updateSkew(samples, "a", 4_000 + 10 * 60 * 1000, 4_000)).toBe(samples);
    expect(updateSkew(samples, "a", 4_000 - 10 * 60 * 1000, 4_000)).toBe(samples);
  });
});

describe("skewFor", () => {
  it("devolve a estimativa do ator", () => {
    expect(skewFor({ a: 1_000 }, "a")).toBe(1_000);
  });

  // Sem amostra, o comportamento é o de antes da compensação existir — a
  // correção nunca piora por falta de dado.
  it("devolve 0 para ator desconhecido, string vazia ou nulo", () => {
    expect(skewFor({ a: 1_000 }, "b")).toBe(0);
    expect(skewFor({ a: 1_000 }, "")).toBe(0);
    expect(skewFor({ a: 1_000 }, null)).toBe(0);
    expect(skewFor({ a: 1_000 }, undefined)).toBe(0);
  });
});
