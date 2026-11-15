import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOwnAvatarVersion } from "@/hooks/useOwnAvatarVersion";

const mocks = vi.hoisted(() => ({ updateMyPresence: vi.fn() }));

vi.mock("@liveblocks/react", () => ({
  useUpdateMyPresence: () => mocks.updateMyPresence,
}));

class FakeChannel {
  static instances: FakeChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();

  constructor(public name: string) {
    FakeChannel.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function channel() {
  return FakeChannel.instances[0];
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

async function voltarAoFoco() {
  setVisibility("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeChannel.instances = [];
  mocks.updateMyPresence.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setVisibility("visible");
});

describe("useOwnAvatarVersion", () => {
  it("devolve o valor inicial sem escrever presença no primeiro render", () => {
    const { result } = renderHook(() => useOwnAvatarVersion(7));
    expect(result.current).toBe(7);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("abre o canal com o nome combinado", () => {
    renderHook(() => useOwnAvatarVersion(undefined));
    expect(channel().name).toBe("rockncine:avatar");
  });

  it("número válido no canal atualiza o estado e escreve a presença uma vez", () => {
    const { result } = renderHook(() => useOwnAvatarVersion(1));
    act(() => channel().emit({ v: 99 }));
    expect(result.current).toBe(99);
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).toHaveBeenCalledWith({ avatarV: 99 });
  });

  it("v nulo remove e escreve avatarV nulo", () => {
    const { result } = renderHook(() => useOwnAvatarVersion(5));
    act(() => channel().emit({ v: null }));
    expect(result.current).toBeNull();
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).toHaveBeenCalledWith({ avatarV: null });
  });

  it("repetir o mesmo valor não escreve de novo", () => {
    renderHook(() => useOwnAvatarVersion(1));
    act(() => channel().emit({ v: 9 }));
    act(() => channel().emit({ v: 9 }));
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["texto", { v: "javascript:alert(1)" }],
    ["fracionário", { v: 1.5 }],
    ["negativo", { v: -1 }],
    ["zero", { v: 0 }],
    ["sem v", { outro: 3 }],
    ["nulo", null],
    ["primitivo", 12],
  ])("mensagem inválida (%s) é ignorada", (_nome, data) => {
    const { result } = renderHook(() => useOwnAvatarVersion(3));
    act(() => channel().emit(data));
    expect(result.current).toBe(3);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("visibilitychange para visível com versão diferente atualiza e escreve (AC-022)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: 20 }));
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(fetchMock).toHaveBeenCalledWith("/api/profile/image", { cache: "no-store" });
    expect(result.current).toBe(20);
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).toHaveBeenCalledWith({ avatarV: 20 });
  });

  it("focus da janela também rechecha", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: null }));
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
    expect(mocks.updateMyPresence).toHaveBeenCalledWith({ avatarV: null });
  });

  it("visibilitychange para oculto não busca", async () => {
    renderHook(() => useOwnAvatarVersion(10));
    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("versão igual não escreve presença", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: 10 }));
    renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("resposta com v inválido é ignorada", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: "x" }));
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(result.current).toBe(10);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("erro de rede é ignorado em silêncio", async () => {
    fetchMock.mockRejectedValue(new Error("rede"));
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(result.current).toBe(10);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("status 500 é ignorado", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: 99 }, 500));
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(result.current).toBe(10);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("JSON inválido é ignorado", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("json");
      },
    });
    const { result } = renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    expect(result.current).toBe(10);
    expect(mocks.updateMyPresence).not.toHaveBeenCalled();
  });

  it("disparos seguidos com a primeira pendente geram um fetch só", async () => {
    let resolver: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    renderHook(() => useOwnAvatarVersion(10));
    await voltarAoFoco();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolver(jsonResponse({ v: 10 }));
    });
    fetchMock.mockResolvedValue(jsonResponse({ v: 10 }));
    await voltarAoFoco();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resposta atrasada do fetch não sobrescreve versão mais nova do canal", async () => {
    let resolver: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    const { result } = renderHook(() => useOwnAvatarVersion(1));
    await voltarAoFoco();
    act(() => channel().emit({ v: 2 }));
    expect(result.current).toBe(2);
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolver(jsonResponse({ v: 1 }));
    });
    expect(result.current).toBe(2);
    expect(mocks.updateMyPresence).toHaveBeenCalledTimes(1);
    expect(mocks.updateMyPresence).not.toHaveBeenCalledWith({ avatarV: 1 });
  });

  it("BroadcastChannel indefinido não quebra", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const { result } = renderHook(() => useOwnAvatarVersion(4));
    expect(result.current).toBe(4);
  });

  it("construtor que lança não quebra", () => {
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        constructor() {
          throw new Error("bloqueado");
        }
      },
    );
    const { result } = renderHook(() => useOwnAvatarVersion(4));
    expect(result.current).toBe(4);
  });

  it("cleanup fecha o canal e remove os listeners", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ v: 50 }));
    const { unmount } = renderHook(() => useOwnAvatarVersion(10));
    const aberto = channel();
    unmount();
    expect(aberto.close).toHaveBeenCalledTimes(1);
    await voltarAoFoco();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
