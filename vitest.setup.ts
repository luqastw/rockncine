import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// O React Testing Library só registra cleanup automático quando `globals: true`.
// Como a config usa imports explícitos, o cleanup é registrado aqui.
afterEach(() => {
  cleanup();
});

// APIs que o jsdom não implementa e que os componentes do player consultam no
// render. Sem o stub, o teste falha com "not a function" em vez de exercitar o
// comportamento sob teste.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  }

  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: ResizeObserverStub });
  }

  if (!window.HTMLMediaElement.prototype.play) {
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      writable: true,
      value: () => Promise.resolve(),
    });
  }
  if (!window.HTMLMediaElement.prototype.pause) {
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      writable: true,
      value: () => undefined,
    });
  }
}
