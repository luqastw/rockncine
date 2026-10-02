import { render, renderHook, act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlaybackSnapshot,
  resetPlaybackClock,
  setPlayback,
  useCurrentTime,
  usePlaybackState,
} from "./usePlaybackClock";

beforeEach(() => {
  resetPlaybackClock();
});

describe("setPlayback / getPlaybackSnapshot", () => {
  it("começa no estado inicial", () => {
    expect(getPlaybackSnapshot()).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      volume: 1,
      isMuted: false,
      error: null,
    });
  });

  it("mescla campos parciais sem apagar os outros", () => {
    setPlayback({ duration: 120 });
    setPlayback({ isPlaying: true });

    expect(getPlaybackSnapshot()).toMatchObject({ duration: 120, isPlaying: true });
  });

  // A store é de módulo e sobrevive à sala. Sem o reset no unmount, o próximo
  // RoomExperience leria o playhead da sala anterior no primeiro render.
  it("resetPlaybackClock volta tudo ao initial", () => {
    setPlayback({ currentTime: 900, isPlaying: true, duration: 1200, error: "x" });
    resetPlaybackClock();
    expect(getPlaybackSnapshot()).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      volume: 1,
      isMuted: false,
      error: null,
    });
  });
});

describe("separação de grupos de notificação", () => {
  it("useCurrentTime re-renderiza a cada tick; usePlaybackState não", () => {
    const timeRenders = vi.fn();
    const stateRenders = vi.fn();

    function Probe() {
      timeRenders();
      const t = useCurrentTime();
      return <span data-testid="t">{t}</span>;
    }
    function StateProbe() {
      stateRenders();
      const s = usePlaybackState();
      return <span data-testid="s">{String(s.isPlaying)}</span>;
    }

    render(
      <>
        <Probe />
        <StateProbe />
      </>,
    );

    const stateBefore = stateRenders.mock.calls.length;
    const timeBefore = timeRenders.mock.calls.length;

    act(() => setPlayback({ currentTime: 12.5 }));

    // O assinante do playhead re-renderizou; o de estado não, porque nada do
    // que ele observa mudou.
    expect(timeRenders.mock.calls.length).toBeGreaterThan(timeBefore);
    expect(stateRenders.mock.calls.length).toBe(stateBefore);
    expect(screen.getByTestId("t").textContent).toBe("12.5");
  });

  it("usePlaybackState re-renderiza em play/pause", () => {
    const { result } = renderHook(() => usePlaybackState());
    expect(result.current.isPlaying).toBe(false);

    act(() => setPlayback({ isPlaying: true }));
    expect(result.current.isPlaying).toBe(true);

    act(() => setPlayback({ isPlaying: false }));
    expect(result.current.isPlaying).toBe(false);
  });

  it("duração, volume, mute e erro também notificam o grupo de estado", () => {
    const { result } = renderHook(() => usePlaybackState());

    act(() => setPlayback({ duration: 300 }));
    expect(result.current.duration).toBe(300);

    act(() => setPlayback({ volume: 0.3 }));
    expect(result.current.volume).toBeCloseTo(0.3);

    act(() => setPlayback({ isMuted: true }));
    expect(result.current.isMuted).toBe(true);

    act(() => setPlayback({ error: "falhou" }));
    expect(result.current.error).toBe("falhou");
  });

  it("repetir o mesmo valor não notifica (seek redundante do PlayerControls)", () => {
    const renders = vi.fn();
    const { result, rerender } = renderHook(() => {
      renders();
      return useCurrentTime();
    });
    const before = renders.mock.calls.length;

    act(() => setPlayback({ currentTime: 5 }));
    const afterFirst = renders.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(before);

    // mesmo valor: nada muda, nada notifica
    act(() => setPlayback({ currentTime: 5 }));
    expect(renders.mock.calls.length).toBe(afterFirst);

    rerender();
    expect(result.current).toBe(5);
  });
});

// O motivo de o store existir. Com `currentTime` em `useState` dentro do hook
// de sync, cada tick re-renderizava o componente da sala inteira — e com ele o
// log de chat com 30 itens. Aqui só o assinante do playhead re-renderiza.
describe("isolamento do caminho quente", () => {
  it("um consumidor que não assina o playhead não re-renderiza no tick", () => {
    const chatRenders = vi.fn();
    const scrubberRenders = vi.fn();

    function Chat() {
      chatRenders();
      return null;
    }
    function Scrubber() {
      scrubberRenders();
      useCurrentTime();
      return null;
    }

    render(
      <>
        <Chat />
        <Scrubber />
      </>,
    );

    const chatBefore = chatRenders.mock.calls.length;
    const scrubberBefore = scrubberRenders.mock.calls.length;

    act(() => {
      setPlayback({ currentTime: 1 });
      setPlayback({ currentTime: 2 });
      setPlayback({ currentTime: 3 });
    });

    expect(chatRenders.mock.calls.length).toBe(chatBefore);
    expect(scrubberRenders.mock.calls.length).toBeGreaterThan(scrubberBefore);
  });
});
