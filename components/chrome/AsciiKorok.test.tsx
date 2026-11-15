import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { AsciiKorok } from "@/components/chrome/AsciiKorok";

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AsciiKorok", () => {
  it("é decorativo e esconde do leitor de tela", () => {
    stubMotion(true);
    const { container } = render(<AsciiKorok />);
    expect(container.querySelector("pre")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("anima o quadro com o tempo", () => {
    stubMotion(false);
    vi.useFakeTimers();
    const { container } = render(<AsciiKorok variant="mini" />);
    const first = container.querySelector("pre")?.textContent;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector("pre")?.textContent).not.toBe(first);
  });

  it("com movimento reduzido fica parado", () => {
    stubMotion(true);
    vi.useFakeTimers();
    const { container } = render(<AsciiKorok />);
    const first = container.querySelector("pre")?.textContent;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector("pre")?.textContent).toBe(first);
  });
});
