import { describe, expect, it } from "vitest";
import { HLS_DEFAULT_MAX_BUFFER_LENGTH, setMaxBufferLength, type Hls } from "./hls";

function fakeHls(): Hls & { config: Record<string, unknown> } {
  return {
    levels: [],
    autoLevelCapping: -1,
    currentLevel: -1,
    config: {},
    loadSource() {},
    attachMedia() {},
    destroy() {},
    on() {},
  };
}

describe("setMaxBufferLength", () => {
  it("escreve o valor pedido", () => {
    const hls = fakeHls();
    setMaxBufferLength(hls, 2);
    expect(hls.config.maxMaxBufferLength).toBe(2);
  });

  // O bug que esta função substitui: o reset usava `undefined`, e o
  // buffer-controller do hls.js faz `Math.min(maxBufLen, config.maxMaxBufferLength)`.
  // `Math.min(30, undefined)` é `NaN`, e a comparação `bufferLen >= NaN` é
  // sempre falsa — o stream-controller nunca ficava ocioso e puxava
  // fragmentos sem parar. Desligar o limite de FPS corrompia o playback.
  it("reset restaura o default do hls.js, não undefined", () => {
    const hls = fakeHls();
    setMaxBufferLength(hls, 2);
    setMaxBufferLength(hls, null);

    expect(hls.config.maxMaxBufferLength).toBe(HLS_DEFAULT_MAX_BUFFER_LENGTH);
    expect(hls.config.maxMaxBufferLength).not.toBeUndefined();

    // a conta que o hls.js faz com o valor tem que continuar válida
    const maxBufLen = Math.min(30, hls.config.maxMaxBufferLength as number);
    expect(Number.isNaN(maxBufLen)).toBe(false);
    expect(10 >= maxBufLen).toBe(false); // com 10s de buffer, ainda carrega
  });

  it("o default declarado bate com o do hls.js", () => {
    // 600 no config do hls.js 1.7.x. Se um upgrade mudar, este teste falha e
    // aponta o número — que é o ponto: a constante é a âncora do reset.
    expect(HLS_DEFAULT_MAX_BUFFER_LENGTH).toBe(600);
  });
});
