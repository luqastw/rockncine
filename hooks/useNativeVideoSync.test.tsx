import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNativeVideoSync } from "./useNativeVideoSync";
import { getPlaybackSnapshot, resetPlaybackClock, setPlayback } from "./usePlaybackClock";
import { lb, NOW, snapshotOf, videoOf } from "./__testutils__/liveblocksMock";

const hlsMod = vi.hoisted(() => ({ load: vi.fn(), setMaxBufferLength: vi.fn() }));

vi.mock("@liveblocks/react", async () =>
  (await import("./__testutils__/liveblocksMock")).liveblocksModule(),
);
vi.mock("@/lib/hls", () => ({
  HLS_MODULE: hlsMod.load,
  setMaxBufferLength: hlsMod.setMaxBufferLength,
}));

const MP4 = "https://cdn.test/video.mp4";
const M3U8 = "https://cdn.test/stream.m3u8";

type HlsHandler = (event: string, data: unknown) => void;

class FakeHls {
  static instances: FakeHls[] = [];
  static supported = true;
  static isSupported = () => FakeHls.supported;
  static Events = { ERROR: "hlsError", MANIFEST_PARSED: "hlsManifestParsed" } as const;
  handlers: Record<string, HlsHandler> = {};
  levels = [{ height: 360 }, { height: 480 }, { height: 720 }, { height: 1080 }];
  autoLevelCapping = -1;
  currentLevel = -1;
  config: Record<string, unknown> = {};
  loadSource = vi.fn();
  attachMedia = vi.fn();
  destroy = vi.fn();
  constructor() {
    FakeHls.instances.push(this);
  }
  on(event: string, handler: HlsHandler) {
    this.handlers[event] = handler;
  }
}

const hls = () => FakeHls.instances[FakeHls.instances.length - 1];

function makeVideo() {
  const state = { currentTime: 0, duration: 100, paused: true, volume: 1, muted: false };
  const el = document.createElement("video");
  el.id = "native";
  const sets: number[] = [];
  Object.defineProperty(el, "currentTime", {
    configurable: true,
    get: () => state.currentTime,
    set: (v: number) => {
      state.currentTime = v;
      sets.push(v);
    },
  });
  Object.defineProperty(el, "duration", { configurable: true, get: () => state.duration });
  Object.defineProperty(el, "paused", { configurable: true, get: () => state.paused });
  Object.defineProperty(el, "volume", {
    configurable: true,
    get: () => state.volume,
    set: (v: number) => {
      state.volume = v;
    },
  });
  Object.defineProperty(el, "muted", {
    configurable: true,
    get: () => state.muted,
    set: (v: boolean) => {
      state.muted = v;
    },
  });
  const play = vi.fn(() => {
    state.paused = false;
    return Promise.resolve();
  });
  const pause = vi.fn(() => {
    state.paused = true;
  });
  el.play = play;
  el.pause = pause;
  return { el, state, sets, play, pause };
}

let v: ReturnType<typeof makeVideo>;

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

type Props = { targetResolution?: "720p" | "480p"; fpsLimit?: "auto" | "30" | "60" };

async function mount(props: Props = {}) {
  lb.video = lb.video ?? videoOf("DIRECT_MEDIA", MP4);
  const hook = renderHook((p: Props) => useNativeVideoSync({ containerId: "native", userId: "me", ...p }), {
    initialProps: props,
  });
  await flush();
  return hook;
}

const domEvent = (name: string) => act(() => v.el.dispatchEvent(new Event(name)));

async function mountReady(props: Props = {}) {
  const hook = await mount(props);
  domEvent("loadedmetadata");
  return hook;
}

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const remote = (overrides: Record<string, unknown> = {}) =>
  lb.emit({ type: "PLAY", time: 20, actorId: "other", ts: NOW + 10, source: "DIRECT_MEDIA", ...overrides });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  lb.reset();
  resetPlaybackClock();
  FakeHls.instances = [];
  FakeHls.supported = true;
  hlsMod.load.mockReset();
  hlsMod.load.mockResolvedValue(FakeHls);
  hlsMod.setMaxBufferLength.mockReset();
  document.body.innerHTML = "";
  v = makeVideo();
  document.body.appendChild(v.el);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNativeVideoSync: ações locais", () => {
  it("evento play do elemento gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mountReady();
    v.state.currentTime = 12.5;
    domEvent("play");

    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 12.5, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PLAY",
      time: 12.5,
      source: "DIRECT_MEDIA",
      actorId: "me",
      ts: NOW,
    });
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("evento pause do elemento gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mountReady();
    v.state.currentTime = 33;
    domEvent("pause");

    expect(lb.commits).toEqual([{ isPlaying: false, currentTime: 33, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PAUSE",
      time: 33,
      source: "DIRECT_MEDIA",
      actorId: "me",
      ts: NOW,
    });
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("controller.seek só move o elemento; o commit e o broadcast saem no evento seeked", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.seek(45));

    expect(v.state.currentTime).toBe(45);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    v.state.paused = false;
    domEvent("seeked");

    expect(getPlaybackSnapshot().currentTime).toBe(45);
    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 45, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "SEEK",
      time: 45,
      source: "DIRECT_MEDIA",
      actorId: "me",
      ts: NOW,
    });
  });

  it("seeked com o vídeo pausado commita isPlaying false", async () => {
    await mountReady();
    v.state.currentTime = 8;
    domEvent("seeked");

    expect(lb.commits[0]).toMatchObject({ isPlaying: false, currentTime: 8 });
  });

  it("play limpa um erro anterior", async () => {
    const { result } = await mountReady();
    domEvent("error");
    expect(result.current.error).not.toBeNull();
    domEvent("play");

    expect(result.current.error).toBeNull();
  });

  it("timeupdate, durationchange e volumechange alimentam a store", async () => {
    await mountReady();
    v.state.currentTime = 7;
    domEvent("timeupdate");
    v.state.duration = 150;
    domEvent("durationchange");
    v.state.volume = 0.3;
    v.state.muted = true;
    domEvent("volumechange");

    expect(getPlaybackSnapshot()).toMatchObject({ currentTime: 7, duration: 150, volume: 0.3, isMuted: true });
  });

  it("durationchange com NaN grava duração 0", async () => {
    await mountReady();
    v.state.duration = Number.NaN;
    domEvent("durationchange");

    expect(getPlaybackSnapshot().duration).toBe(0);
  });
});

describe("useNativeVideoSync: eventos remotos e eco", () => {
  it("PLAY remoto ajusta currentTime e chama play", async () => {
    await mountReady();
    remote({ type: "PLAY", time: 20 });

    expect(v.state.currentTime).toBe(20);
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("PAUSE remoto ajusta currentTime e chama pause", async () => {
    await mountReady();
    remote({ type: "PAUSE", time: 21 });

    expect(v.state.currentTime).toBe(21);
    expect(v.pause).toHaveBeenCalledTimes(1);
  });

  it("SEEK remoto só ajusta currentTime", async () => {
    await mountReady();
    remote({ type: "SEEK", time: 70 });

    expect(v.state.currentTime).toBe(70);
    expect(v.play).not.toHaveBeenCalled();
    expect(v.pause).not.toHaveBeenCalled();
  });

  it("eventos do elemento durante o cooldown não são emitidos; depois do cooldown voltam a ser", async () => {
    await mountReady();
    remote();

    domEvent("seeked");
    domEvent("play");
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(1499);
    domEvent("pause");
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(1);
    domEvent("pause");
    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("o evento seeked durante o cooldown ainda atualiza o relógio local", async () => {
    await mountReady();
    remote({ type: "SEEK", time: 70 });
    domEvent("seeked");

    expect(getPlaybackSnapshot().currentTime).toBe(70);
  });

  it("ação local dentro do cooldown é descartada e não chega aos outros", async () => {
    await mountReady();
    remote();
    tick(500);
    v.state.currentTime = 99;
    domEvent("pause");

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("applyRemote cancela o timeout anterior: a flag segue ativa até o cooldown da segunda chamada", async () => {
    await mountReady();
    remote({ ts: NOW + 10 });
    tick(1000);
    remote({ type: "SEEK", ts: NOW + 20, time: 30 });

    tick(600);
    domEvent("pause");
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(900);
    domEvent("pause");
    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("unmount cancela o timeout de cooldown pendente", async () => {
    const hook = await mountReady();
    remote();
    const clearSpy = vi.spyOn(window, "clearTimeout");
    hook.unmount();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("segunda chamada de applyRemote ainda protege antes do primeiro timeout vencer", async () => {
    await mountReady();
    remote({ ts: NOW + 10 });
    tick(1000);
    remote({ type: "SEEK", ts: NOW + 20, time: 30 });

    tick(400);
    domEvent("pause");

    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useNativeVideoSync: eventos descartados", () => {
  it.each([
    ["actorId igual ao userId", { actorId: "me" }],
    ["source de outro player", { source: "YOUTUBE" }],
    ["type inválido", { type: "LOAD_VIDEO" }],
    ["actorId vazio", { actorId: "" }],
    ["time negativo", { time: -1 }],
    ["time acima do teto", { time: 12 * 60 * 60 + 1 }],
    ["time não numérico", { time: "10" }],
    ["ts longe do relógio local", { ts: NOW + 31_000 }],
    ["ts não finito", { ts: Number.NaN }],
    ["source desconhecida", { source: "OTHER" }],
  ])("descarta evento com %s", async (_label, overrides) => {
    await mountReady();
    remote(overrides);

    expect(v.sets).toEqual([]);
    expect(v.play).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "PLAY", 42, [], {}])("descarta payload %j", async (payload) => {
    await mountReady();
    lb.emit(payload);

    expect(v.sets).toEqual([]);
  });

  it("descarta evento com ts <= ao último aplicado", async () => {
    await mountReady();
    remote({ type: "SEEK", ts: NOW + 100, time: 20 });
    tick(1500);
    remote({ type: "SEEK", ts: NOW + 100, time: 25 });
    remote({ type: "SEEK", ts: NOW + 50, time: 26 });

    expect(v.sets).toEqual([20]);
  });

  it("descarta evento mais antigo que uma ação local recente", async () => {
    await mountReady();
    domEvent("play");
    remote({ type: "SEEK", ts: NOW - 1 });

    expect(v.sets).toEqual([]);
  });

  it("descarta evento remoto quando a fonte não é DIRECT_MEDIA", async () => {
    lb.video = videoOf("YOUTUBE", "abc");
    await mount();
    remote();

    expect(v.sets).toEqual([]);
  });
});

describe("useNativeVideoSync: late join", () => {
  it("snapshot tocando: currentTime ao tempo esperado e play", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();
    domEvent("loadedmetadata");

    expect(v.state.currentTime).toBe(14);
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.pause).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("snapshot pausado: currentTime ao valor salvo e pause", async () => {
    lb.player = snapshotOf({ isPlaying: false, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();
    domEvent("loadedmetadata");

    expect(v.state.currentTime).toBe(10);
    expect(v.pause).toHaveBeenCalledTimes(1);
    expect(v.play).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("snapshot velho demais é tratado como pausado", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 5 * 60 * 1000 - 1 });
    await mount();
    domEvent("loadedmetadata");

    expect(v.state.currentTime).toBe(10);
    expect(v.pause).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("clampa pela duração menos 0,5s", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 99, updatedAt: NOW - 4000 });
    await mount();
    domEvent("loadedmetadata");

    expect(v.state.currentTime).toBe(99.5);
  });

  it("sem snapshot não mexe no elemento", async () => {
    await mountReady();

    expect(v.sets).toEqual([]);
    expect(v.play).not.toHaveBeenCalled();
    expect(v.pause).not.toHaveBeenCalled();
  });

  it("loadedmetadata marca isReady e copia duração, volume e mute", async () => {
    v.state.duration = 200;
    v.state.volume = 0.4;
    v.state.muted = true;
    const { result } = await mount();
    expect(result.current.isReady).toBe(false);
    domEvent("loadedmetadata");

    expect(result.current.isReady).toBe(true);
    expect(getPlaybackSnapshot()).toMatchObject({ duration: 200, volume: 0.4, isMuted: true });
  });

  it("late join não emite mesmo com play/seeked do elemento logo depois", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW });
    await mount();
    domEvent("loadedmetadata");
    domEvent("seeked");
    domEvent("play");

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("compensa o skew do relógio do ator estimado por eventos anteriores", async () => {
    const hook = await mount();
    remote({ type: "SEEK", time: 1, ts: NOW + 2000 });
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW + 2000 });
    hook.rerender({});
    domEvent("loadedmetadata");

    expect(v.state.currentTime).toBe(10);
  });
});

describe("useNativeVideoSync: drift", () => {
  async function readyWithSnapshot(snapshot: ReturnType<typeof snapshotOf>) {
    const hook = await mountReady();
    lb.player = snapshot;
    hook.rerender({});
    return hook;
  }

  it("seguidor fora do limiar de 1,5s ajusta currentTime ao esperado", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    v.state.currentTime = 20;
    tick(3000);

    expect(v.sets).toEqual([13]);
    expect(v.state.currentTime).toBe(13);
  });

  it("seguidor dentro do limiar não ajusta", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    v.state.currentTime = 14.4;
    tick(3000);

    expect(v.state.currentTime).toBe(14.4);
  });

  it("dono (lastActorId igual ao userId) não corrige drift", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, lastActorId: "me" }));
    v.state.currentTime = 50;
    tick(3000);

    expect(v.state.currentTime).toBe(50);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("snapshot velho demais não arrasta o seguidor", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 6 * 60 * 1000 }));
    v.state.currentTime = 90;
    tick(3000);

    expect(v.state.currentTime).toBe(90);
  });

  it("sem snapshot não corrige", async () => {
    await mountReady();
    v.state.currentTime = 90;
    tick(3000);

    expect(v.state.currentTime).toBe(90);
  });

  it("antes do loadedmetadata (isReady false) não corrige", async () => {
    const hook = await mount();
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10 });
    hook.rerender({});
    v.state.currentTime = 90;
    tick(3000);

    expect(v.state.currentTime).toBe(90);
  });

  it("não corrige durante o cooldown de um evento remoto", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    v.state.currentTime = 20;
    tick(2900);
    remote({ type: "SEEK", time: 20 });
    tick(100);

    expect(v.state.currentTime).toBe(20);
  });

  it("a correção de drift não gera commit nem broadcast mesmo com o seeked seguinte, dentro do cooldown", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    v.state.currentTime = 20;
    tick(3000);
    domEvent("seeked");

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useNativeVideoSync: ciclo de vida", () => {
  it("mp4 define src do elemento e não usa HLS", async () => {
    await mount();

    expect(v.el.src).toBe(MP4);
    expect(hlsMod.load).not.toHaveBeenCalled();
  });

  it("sem o elemento no DOM não faz nada", async () => {
    document.body.innerHTML = "";
    const { result } = await mount();

    expect(result.current.isReady).toBe(false);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("saída da fonte zera isReady e para de reagir ao elemento", async () => {
    const hook = await mountReady();
    expect(hook.result.current.isReady).toBe(true);

    lb.video = videoOf("YOUTUBE", "abc");
    hook.rerender({});
    domEvent("play");

    expect(hook.result.current.isReady).toBe(false);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("saída da fonte ignora eventos remotos", async () => {
    const hook = await mountReady();
    lb.video = null;
    hook.rerender({});
    remote();

    expect(v.sets).toEqual([]);
  });

  it("saída da fonte com HLS destrói o hls e zera isReady", async () => {
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
    const hook = await mountReady();
    const instance = hls();
    lb.video = null;
    hook.rerender({});

    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("unmount destrói o hls, remove listeners e reseta o relógio", async () => {
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
    const hook = await mountReady();
    setPlayback({ currentTime: 50, isPlaying: true, duration: 100 });
    const instance = hls();
    hook.unmount();
    domEvent("play");

    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot()).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      volume: 1,
      isMuted: false,
      error: null,
    });
  });

  it("unmount antes do módulo HLS carregar não cria instância", async () => {
    let release: () => void = () => {};
    hlsMod.load.mockReturnValue(new Promise<typeof FakeHls>((resolve) => (release = () => resolve(FakeHls))));
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
    const hook = renderHook(() => useNativeVideoSync({ containerId: "native", userId: "me" }));
    hook.unmount();
    await act(async () => {
      release();
    });

    expect(FakeHls.instances).toHaveLength(0);
  });
});

describe("useNativeVideoSync: retry", () => {
  it("recarregar a mesma URL com o player pronto e sem erro reinicia em 0 e dá play, sem reatribuir src", async () => {
    const hook = await mountReady();
    v.state.currentTime = 50;
    v.sets.length = 0;
    lb.video = videoOf("DIRECT_MEDIA", MP4, 2);
    hook.rerender({});

    expect(v.sets).toEqual([0]);
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(true);
  });

  it("recarregar a mesma URL depois de um erro refaz o carregamento e zera isReady e erro", async () => {
    const hook = await mountReady();
    domEvent("error");
    expect(hook.result.current.error).toBe("não foi possível reproduzir este vídeo.");

    lb.video = videoOf("DIRECT_MEDIA", MP4, 2);
    hook.rerender({});

    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.isReady).toBe(false);
    expect(v.play).not.toHaveBeenCalled();
  });

  it("recarregar uma URL nova troca o src e zera isReady", async () => {
    const hook = await mountReady();
    lb.video = videoOf("DIRECT_MEDIA", "https://cdn.test/outro.mp4", 2);
    hook.rerender({});

    expect(v.el.src).toBe("https://cdn.test/outro.mp4");
    expect(hook.result.current.isReady).toBe(false);
  });

  it("recarregar HLS com erro destrói a instância antiga e cria outra", async () => {
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
    const hook = await mountReady();
    const first = hls();
    domEvent("error");
    lb.video = videoOf("DIRECT_MEDIA", M3U8, 2);
    hook.rerender({});
    await flush();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(FakeHls.instances).toHaveLength(2);
  });

  it("recarregar HLS pronto e sem erro também recria a instância, porque o atalho exige videoEl.src", async () => {
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
    const hook = await mountReady();
    const first = hls();
    lb.video = videoOf("DIRECT_MEDIA", M3U8, 2);
    hook.rerender({});
    await flush();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(FakeHls.instances).toHaveLength(2);
    expect(hook.result.current.isReady).toBe(false);
  });
});

describe("useNativeVideoSync: HLS", () => {
  const hlsVideo = () => {
    lb.video = videoOf("DIRECT_MEDIA", M3U8);
  };
  const parsed = () => act(() => hls().handlers.hlsManifestParsed("hlsManifestParsed", {}));

  it("carrega a fonte e anexa o elemento", async () => {
    hlsVideo();
    await mount();

    expect(hls().loadSource).toHaveBeenCalledWith(M3U8);
    expect(hls().attachMedia).toHaveBeenCalledWith(v.el);
  });

  it("manifest parseado limita autoLevelCapping ao maior nível <= 720", async () => {
    hlsVideo();
    await mount({ targetResolution: "720p" });
    parsed();

    expect(hls().autoLevelCapping).toBe(2);
  });

  it("manifest parseado com 480p limita ao nível de 480", async () => {
    hlsVideo();
    await mount({ targetResolution: "480p" });
    parsed();

    expect(hls().autoLevelCapping).toBe(1);
  });

  it("nenhum nível elegível resulta em autoLevelCapping -1", async () => {
    hlsVideo();
    await mount({ targetResolution: "480p" });
    hls().levels = [{ height: 1080 }];
    parsed();

    expect(hls().autoLevelCapping).toBe(-1);
  });

  it("fpsLimit 30 reduz o buffer máximo ao parsear o manifest", async () => {
    hlsVideo();
    await mount({ fpsLimit: "30" });
    parsed();

    expect(hlsMod.setMaxBufferLength).toHaveBeenCalledWith(hls(), 2);
  });

  it("fpsLimit auto não mexe no buffer ao parsear o manifest", async () => {
    hlsVideo();
    await mount({ fpsLimit: "auto" });
    parsed();

    expect(hlsMod.setMaxBufferLength).not.toHaveBeenCalled();
  });

  it("trocar a resolução recalcula o teto e rebaixa currentLevel acima dele", async () => {
    hlsVideo();
    const hook = await mount({ targetResolution: "720p" });
    parsed();
    hls().currentLevel = 2;
    hook.rerender({ targetResolution: "480p" });

    expect(hls().autoLevelCapping).toBe(1);
    expect(hls().currentLevel).toBe(1);
  });

  it("trocar a resolução não mexe em currentLevel que já está abaixo do teto", async () => {
    hlsVideo();
    const hook = await mount({ targetResolution: "480p" });
    parsed();
    hls().currentLevel = 0;
    hook.rerender({ targetResolution: "720p" });

    expect(hls().autoLevelCapping).toBe(2);
    expect(hls().currentLevel).toBe(0);
  });

  it("trocar a resolução sem níveis carregados não faz nada", async () => {
    hlsVideo();
    const hook = await mount({ targetResolution: "720p" });
    hls().levels = [];
    hook.rerender({ targetResolution: "480p" });

    expect(hls().autoLevelCapping).toBe(-1);
  });

  it("trocar fpsLimit ajusta o buffer: 30 reduz, auto restaura", async () => {
    hlsVideo();
    const hook = await mount({ fpsLimit: "auto" });
    hook.rerender({ fpsLimit: "30" });
    expect(hlsMod.setMaxBufferLength).toHaveBeenLastCalledWith(hls(), 2);

    hook.rerender({ fpsLimit: "auto" });
    expect(hlsMod.setMaxBufferLength).toHaveBeenLastCalledWith(hls(), null);
  });

  it("erro fatal do hls vira mensagem de stream", async () => {
    hlsVideo();
    const { result } = await mount();
    act(() => hls().handlers.hlsError("hlsError", { fatal: true }));

    expect(result.current.error).toBe("falha ao carregar o stream (manifest/rede). tente carregar de novo.");
  });

  it("erro não fatal do hls é ignorado", async () => {
    hlsVideo();
    const { result } = await mount();
    act(() => hls().handlers.hlsError("hlsError", { fatal: false }));
    act(() => hls().handlers.hlsError("hlsError", null));

    expect(result.current.error).toBeNull();
  });

  it("hls suportado expõe resolution do alvo", async () => {
    hlsVideo();
    const { result } = await mount({ targetResolution: "480p" });

    expect(result.current.controller.resolution).toBe("480p");
  });

  it("hls não suportado cai no src nativo e resolution fica null", async () => {
    FakeHls.supported = false;
    hlsVideo();
    const { result } = await mount();

    expect(v.el.src).toBe(M3U8);
    expect(FakeHls.instances).toHaveLength(0);
    expect(result.current.controller.resolution).toBeNull();
  });

  it("falha ao importar hls.js cai no src nativo e resolution fica null", async () => {
    hlsMod.load.mockRejectedValue(new Error("chunk"));
    hlsVideo();
    const { result } = await mount();

    expect(v.el.src).toBe(M3U8);
    expect(result.current.controller.resolution).toBeNull();
  });

  it("mp4 expõe resolution null", async () => {
    const { result } = await mount();

    expect(result.current.controller.resolution).toBeNull();
  });

  it("expõe o fpsLimit recebido no controller", async () => {
    const { result } = await mount({ fpsLimit: "60" });

    expect(result.current.controller.fpsLimit).toBe("60");
  });
});

describe("useNativeVideoSync: controller", () => {
  it("getters refletem a store de playback", async () => {
    const { result } = await mountReady();
    setPlayback({ currentTime: 3, duration: 9, isPlaying: true, volume: 0.2, isMuted: true });

    expect(result.current.controller).toMatchObject({
      currentTime: 3,
      duration: 9,
      isPlaying: true,
      volume: 0.2,
      isMuted: true,
    });
  });

  it("play e pause delegam ao elemento", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.play());
    act(() => result.current.controller.pause());

    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.pause).toHaveBeenCalledTimes(1);
  });

  it("togglePlay decide pelo estado paused do elemento", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.togglePlay());
    expect(v.play).toHaveBeenCalledTimes(1);
    expect(v.state.paused).toBe(false);

    act(() => result.current.controller.togglePlay());
    expect(v.pause).toHaveBeenCalledTimes(1);
  });

  it("setVolume > 0 ajusta o volume e desmuta", async () => {
    const { result } = await mountReady();
    v.state.muted = true;
    act(() => result.current.controller.setVolume(0.5));

    expect(v.state.volume).toBe(0.5);
    expect(v.state.muted).toBe(false);
  });

  it("setVolume 0 não desmuta", async () => {
    const { result } = await mountReady();
    v.state.muted = true;
    act(() => result.current.controller.setVolume(0));

    expect(v.state.volume).toBe(0);
    expect(v.state.muted).toBe(true);
  });

  it("toggleMute inverte muted do elemento", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.toggleMute());
    expect(v.state.muted).toBe(true);

    act(() => result.current.controller.toggleMute());
    expect(v.state.muted).toBe(false);
  });

  it("sem elemento os controles são no-op", async () => {
    document.body.innerHTML = "";
    const { result } = await mount();
    const { controller } = result.current;
    act(() => {
      controller.play();
      controller.pause();
      controller.togglePlay();
      controller.seek(5);
      controller.setVolume(0.5);
      controller.toggleMute();
    });

    expect(v.sets).toEqual([]);
    expect(v.play).not.toHaveBeenCalled();
  });
});

describe("useNativeVideoSync: erros", () => {
  it("evento error do elemento mapeia a mensagem", async () => {
    const { result } = await mountReady();
    domEvent("error");

    expect(result.current.error).toBe("não foi possível reproduzir este vídeo.");
    expect(result.current.controller.error).toBe("não foi possível reproduzir este vídeo.");
  });

  it("play() rejeitado por política do navegador vira erro", async () => {
    const { result } = await mountReady();
    v.play.mockRejectedValueOnce(new DOMException("bloqueado", "NotAllowedError"));
    act(() => result.current.controller.play());
    await flush();

    expect(result.current.error).toBe("não foi possível iniciar a reprodução. tente de novo.");
  });

  it("play() rejeitado com AbortError é ignorado", async () => {
    const { result } = await mountReady();
    v.play.mockRejectedValueOnce(new DOMException("interrompido", "AbortError"));
    act(() => result.current.controller.play());
    await flush();

    expect(result.current.error).toBeNull();
  });

  it("togglePlay com play() rejeitado também vira erro", async () => {
    const { result } = await mountReady();
    v.play.mockRejectedValueOnce(new Error("falhou"));
    act(() => result.current.controller.togglePlay());
    await flush();

    expect(result.current.error).toBe("não foi possível iniciar a reprodução. tente de novo.");
  });
});
