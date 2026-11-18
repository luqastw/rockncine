import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_HIDE_MS, hasActiveHold, useIdleHide } from "./useIdleHide";

function Probe({ enabled, held = false }: { enabled: boolean; held?: boolean }) {
  const { idle, wake } = useIdleHide({ enabled, isHeld: () => held });
  return (
    <div data-testid="stage" data-idle={idle} onMouseMove={wake} onKeyDown={wake}>
      <button data-idle-hold="">controle</button>
    </div>
  );
}

function stage() {
  return screen.getByTestId("stage");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleHide", () => {
  it("esconde depois do atraso quando está tocando", () => {
    render(<Probe enabled />);

    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS - 100));
    expect(stage().dataset.idle).toBe("false");
    act(() => vi.advanceTimersByTime(200));

    expect(stage().dataset.idle).toBe("true");
  });

  it("reaparece com movimento do mouse e esconde de novo depois", () => {
    render(<Probe enabled />);
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS + 100));

    fireEvent.mouseMove(stage());
    expect(stage().dataset.idle).toBe("false");
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS + 100));

    expect(stage().dataset.idle).toBe("true");
  });

  it("reaparece com tecla", () => {
    render(<Probe enabled />);
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS + 100));

    fireEvent.keyDown(stage(), { key: "a" });

    expect(stage().dataset.idle).toBe("false");
  });

  it("movimento reinicia a contagem", () => {
    render(<Probe enabled />);
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS - 500));
    fireEvent.mouseMove(stage());
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS - 500));

    expect(stage().dataset.idle).toBe("false");
  });

  it("nunca esconde pausado", () => {
    render(<Probe enabled={false} />);

    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS * 4));

    expect(stage().dataset.idle).toBe("false");
  });

  it("não esconde enquanto algo segura (hover, foco ou menu)", () => {
    render(<Probe enabled held />);

    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS * 4));

    expect(stage().dataset.idle).toBe("false");
  });

  it("pausar com a barra escondida mostra de volta", () => {
    const { rerender } = render(<Probe enabled />);
    act(() => vi.advanceTimersByTime(IDLE_HIDE_MS + 100));
    expect(stage().dataset.idle).toBe("true");

    rerender(<Probe enabled={false} />);

    expect(stage().dataset.idle).toBe("false");
  });
});

describe("hasActiveHold", () => {
  it("sem foco visível nem hover não segura, mesmo com foco por clique", () => {
    render(<Probe enabled />);
    const button = screen.getByRole("button");
    button.focus();

    expect(hasActiveHold(stage())).toBe(false);
  });

  it("segura enquanto o foco está visível dentro do alvo", () => {
    render(<Probe enabled />);
    const button = screen.getByRole("button");
    button.focus();
    const original = button.matches.bind(button);
    button.matches = (selector: string) => selector === ":focus-visible" || original(selector);

    expect(hasActiveHold(stage())).toBe(true);
  });
});
