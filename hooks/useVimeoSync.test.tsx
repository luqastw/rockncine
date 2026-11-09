import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVimeoSync } from "./useVimeoSync";
import { getPlaybackSnapshot, resetPlaybackClock, setPlayback } from "./usePlaybackClock";
import { lb, NOW, snapshotOf, videoOf } from "./__testutils__/liveblocksMock";

const mod = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("@liveblocks/react", async () =>
  (await import("./__testutils__/liveblocksMock")).liveblocksModule(),
);
vi.mock("@/lib/vimeo", () => ({ VIMEO_MODULE: mod.load }));

type Handler = (data: Record<string, unknown>) => void;

const QUALITIES = [
  { id: "1080p", width: 1920, height: 1080 },
  { id: "720p", width: 1280, height: 720 },
  { id: "540p", width: 960, height: 540 },
  { id: "360p", width: 640, height: 360 },
  { id: "auto", width: 0, height: 0 },
];

class FakeVimeo {
  static instances: FakeVimeo[] = [];
  handlers: Record<string, Handler> = {};
  duration = 100;
  currentTime = 0;
  volume = 1;
  muted = false;
  qualities = QUALITIES;
  getDuration = vi.fn(() => Promise.resolve(this.duration));
  getCurrentTime = vi.fn(() => Promise.resolve(this.currentTime));
  getVolume = vi.fn(() => Promise.resolve(this.volume));
  getMuted = vi.fn(() => Promise.resolve(this.muted));
  getQualities = vi.fn(() => Promise.resolve(this.qualities));
  setQuality = vi.fn(() => Promise.resolve());
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(() => Promise.resolve());
  setCurrentTime = vi.fn<(seconds: number) => Promise<void>>(() => Promise.resolve());
  setVolume = vi.fn(() => Promise.resolve());
  setMuted = vi.fn(() => Promise.resolve());
  loadVideo = vi.fn<(id: string) => Promise<number>>(() => Promise.resolve(1));
  destroy = vi.fn(() => Promise.resolve());
  ready = vi.fn(() => Promise.resolve());
  constructor(
    public element: HTMLElement,
    public options: Record<string, unknown>,
  ) {
    FakeVimeo.instances.push(this);
  }
  on(event: string, handler: Handler) {
    this.handlers[event] = handler;
  }
}

const player = () => FakeVimeo.instances[0];

function deferred() {
  let resolve: () => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

type Props = { targetResolution?: "720p" | "480p" };

async function mount(props: Props = {}) {
  lb.video = lb.video ?? videoOf("VIMEO", "123456");
  const hook = renderHook((p: Props) => useVimeoSync({ containerId: "vimeo", userId: "me", ...p }), {
    initialProps: props,
  });
  await flush();
  return hook;
}

const fire = (event: string, data: Record<string, unknown> = {}) =>
  act(() => player().handlers[event](data));

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const remote = (overrides: Record<string, unknown> = {}) =>
  lb.emit({ type: "PLAY", time: 20, actorId: "other", ts: NOW + 10, source: "VIMEO", ...overrides });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  lb.reset();
  resetPlaybackClock();
  FakeVimeo.instances = [];
  mod.load.mockReset();
  mod.load.mockResolvedValue(FakeVimeo);
  document.body.innerHTML = '<div id="vimeo"></div>';
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useVimeoSync: ações locais", () => {
  it("play gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mount();
    fire("play", { seconds: 12.5 });

    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 12.5, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PLAY",
      time: 12.5,
      source: "VIMEO",
      actorId: "me",
      ts: NOW,
    });
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("pause gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mount();
    fire("pause", { seconds: 33 });

    expect(lb.commits).toEqual([{ isPlaying: false, currentTime: 33, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PAUSE",
      time: 33,
      source: "VIMEO",
      actorId: "me",
      ts: NOW,
    });
  });

  it("eventos sem seconds usam 0", async () => {
    await mount();
    fire("play");
    fire("pause");

    expect(lb.commits.map((c) => c.currentTime)).toEqual([0, 0]);
  });

  it("seeked do player gera SEEK usando isPlaying do storage", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 1, lastActorId: "other" });
    await mount();
    fire("seeked", { seconds: 40 });

    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 40, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "SEEK",
      time: 40,
      source: "VIMEO",
      actorId: "me",
      ts: NOW,
    });
  });

  it("seeked sem snapshot no storage commita isPlaying false", async () => {
    await mount();
    fire("seeked", { seconds: 4 });

    expect(lb.commits[0]).toMatchObject({ isPlaying: false, currentTime: 4 });
  });

  it("controller.seek faz setCurrentTime, atualiza o relógio e gera 1 commit e 1 broadcast", async () => {
    const { result } = await mount();
    setPlayback({ isPlaying: true });
    act(() => result.current.controller.seek(45));

    expect(player().setCurrentTime).toHaveBeenCalledWith(45);
    expect(getPlaybackSnapshot().currentTime).toBe(45);
    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 45, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "SEEK",
      time: 45,
      source: "VIMEO",
      actorId: "me",
      ts: NOW,
    });
  });

  it("seek não gera eco do evento seeked que o SDK dispara logo depois", async () => {
    const { result } = await mount();
    const gate = deferred();
    player().setCurrentTime.mockReturnValueOnce(gate.promise);
    act(() => result.current.controller.seek(45));
    fire("seeked", { seconds: 45 });

    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("timeupdate atualiza currentTime e duration na store", async () => {
    await mount();
    fire("timeupdate", { seconds: 7, duration: 150 });

    expect(getPlaybackSnapshot()).toMatchObject({ currentTime: 7, duration: 150 });
  });

  it("timeupdate sem duration preserva a duração anterior", async () => {
    await mount();
    setPlayback({ duration: 90 });
    fire("timeupdate", { seconds: 7 });

    expect(getPlaybackSnapshot()).toMatchObject({ currentTime: 7, duration: 90 });
  });
});

describe("useVimeoSync: eventos remotos e eco", () => {
  it("PLAY remoto faz setCurrentTime, play e marca isPlaying", async () => {
    await mount();
    remote({ type: "PLAY", time: 20 });
    await flush();

    expect(player().setCurrentTime).toHaveBeenCalledWith(20);
    expect(player().play).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("PAUSE remoto faz setCurrentTime, pause e desmarca isPlaying", async () => {
    await mount();
    setPlayback({ isPlaying: true });
    remote({ type: "PAUSE", time: 21 });
    await flush();

    expect(player().setCurrentTime).toHaveBeenCalledWith(21);
    expect(player().pause).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("SEEK remoto faz setCurrentTime e atualiza o relógio imediatamente", async () => {
    await mount();
    remote({ type: "SEEK", time: 70 });

    expect(player().setCurrentTime).toHaveBeenCalledWith(70);
    expect(getPlaybackSnapshot().currentTime).toBe(70);
    expect(player().play).not.toHaveBeenCalled();
    expect(player().pause).not.toHaveBeenCalled();
  });

  it("ação local durante a aplicação remota não é emitida; depois que a promessa resolve volta a ser", async () => {
    await mount();
    const gate = deferred();
    player().setCurrentTime.mockReturnValueOnce(gate.promise);
    remote({ type: "PLAY", time: 20 });

    fire("play", { seconds: 20 });
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    gate.resolve();
    await flush();
    fire("pause", { seconds: 25 });

    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("promessa rejeitada também libera a flag de eco", async () => {
    await mount();
    const gate = deferred();
    player().setCurrentTime.mockReturnValueOnce(gate.promise);
    remote({ type: "SEEK", time: 20 });
    gate.reject(new Error("falhou"));
    await flush();
    fire("pause", { seconds: 25 });

    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("ação local enquanto a aplicação remota está pendente é descartada", async () => {
    await mount();
    const gate = deferred();
    player().setCurrentTime.mockReturnValueOnce(gate.promise);
    remote({ type: "SEEK", time: 20 });
    fire("pause", { seconds: 99 });

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("applyRemote rastreia a chamada mais recente: a flag só zera quando a última promessa resolve", async () => {
    await mount();
    const first = deferred();
    const second = deferred();
    player().setCurrentTime.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    remote({ type: "SEEK", time: 20, ts: NOW + 10 });
    remote({ type: "SEEK", time: 30, ts: NOW + 20 });

    first.resolve();
    await flush();
    fire("pause", { seconds: 31 });
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    second.resolve();
    await flush();
    fire("pause", { seconds: 32 });
    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("a segunda chamada ainda protege enquanto nenhuma promessa resolveu", async () => {
    await mount();
    const first = deferred();
    const second = deferred();
    player().setCurrentTime.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    remote({ type: "SEEK", time: 20, ts: NOW + 10 });
    remote({ type: "SEEK", time: 30, ts: NOW + 20 });
    fire("pause", { seconds: 31 });

    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useVimeoSync: eventos descartados", () => {
  it.each([
    ["actorId igual ao userId", { actorId: "me" }],
    ["source de outro player", { source: "YOUTUBE" }],
    ["type inválido", { type: "LOAD_VIDEO" }],
    ["actorId vazio", { actorId: "" }],
    ["time negativo", { time: -1 }],
    ["time acima do teto", { time: 12 * 60 * 60 + 1 }],
    ["time não numérico", { time: "10" }],
    ["ts longe do relógio local", { ts: NOW - 31_000 }],
    ["ts não finito", { ts: Number.POSITIVE_INFINITY }],
    ["source desconhecida", { source: "OTHER" }],
  ])("descarta evento com %s", async (_label, overrides) => {
    await mount();
    remote(overrides);
    await flush();

    expect(player().setCurrentTime).not.toHaveBeenCalled();
    expect(player().play).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it.each([null, undefined, "PLAY", 42, [], {}])("descarta payload %j", async (payload) => {
    await mount();
    lb.emit(payload);

    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("descarta evento com ts <= ao último aplicado", async () => {
    await mount();
    remote({ type: "SEEK", ts: NOW + 100, time: 20 });
    await flush();
    remote({ type: "SEEK", ts: NOW + 100, time: 25 });
    remote({ type: "SEEK", ts: NOW + 50, time: 26 });

    expect(player().setCurrentTime).toHaveBeenCalledTimes(1);
    expect(player().setCurrentTime).toHaveBeenCalledWith(20);
  });

  it("descarta evento mais antigo que uma ação local recente", async () => {
    await mount();
    fire("play", { seconds: 1 });
    remote({ type: "SEEK", ts: NOW - 1 });

    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("descarta evento remoto enquanto não há player", async () => {
    lb.video = videoOf("YOUTUBE", "abc");
    await mount();
    remote();

    expect(FakeVimeo.instances).toHaveLength(0);
  });
});

describe("useVimeoSync: late join", () => {
  it("snapshot tocando: setCurrentTime ao tempo esperado e play", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();

    expect(player().setCurrentTime).toHaveBeenCalledWith(14);
    expect(player().play).toHaveBeenCalledTimes(1);
    expect(player().pause).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("snapshot pausado: setCurrentTime ao currentTime e pause", async () => {
    lb.player = snapshotOf({ isPlaying: false, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();

    expect(player().setCurrentTime).toHaveBeenCalledWith(10);
    expect(player().pause).toHaveBeenCalledTimes(1);
    expect(player().play).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("snapshot velho demais é tratado como pausado", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 5 * 60 * 1000 - 1 });
    await mount();

    expect(player().setCurrentTime).toHaveBeenCalledWith(10);
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("clampa pela duração menos 0,5s", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 99, updatedAt: NOW - 4000 });
    await mount();

    expect(player().setCurrentTime).toHaveBeenCalledWith(99.5);
  });

  it("sem snapshot não faz seek nem play", async () => {
    await mount();

    expect(player().setCurrentTime).not.toHaveBeenCalled();
    expect(player().play).not.toHaveBeenCalled();
    expect(player().pause).not.toHaveBeenCalled();
  });

  it("ready copia duração, volume e mute do player e marca isReady", async () => {
    const { result } = await mount();

    expect(result.current.isReady).toBe(true);
    expect(player().getVolume).toHaveBeenCalled();
    expect(player().getMuted).toHaveBeenCalled();
    expect(getPlaybackSnapshot()).toMatchObject({ duration: 100, volume: 1, isMuted: false });
  });

  it("cria o player com id, controls false e max_quality 720p", async () => {
    await mount();

    expect(player().element).toBe(document.getElementById("vimeo"));
    expect(player().options).toEqual({ id: "123456", controls: false, max_quality: "720p" });
  });

  it("compensa o skew do relógio do ator ao reaplicar o snapshot no reload", async () => {
    const hook = await mount();
    remote({ type: "SEEK", time: 1, ts: NOW + 2000 });
    await flush();
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW + 2000 });
    lb.video = videoOf("VIMEO", "999", 2);
    hook.rerender({});
    await flush();

    expect(player().setCurrentTime).toHaveBeenLastCalledWith(10);
  });
});

describe("useVimeoSync: drift", () => {
  async function readyWithSnapshot(snapshot: ReturnType<typeof snapshotOf>) {
    const hook = await mount();
    lb.player = snapshot;
    hook.rerender({});
    return hook;
  }

  const driftTick = async () => {
    tick(3000);
    await flush();
  };

  it("seguidor fora do limiar de 1,5s faz seek ao tempo esperado", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 20;
    await driftTick();

    expect(player().setCurrentTime).toHaveBeenCalledWith(13);
  });

  it("seguidor dentro do limiar não faz seek", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 14.4;
    await driftTick();

    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("dono (lastActorId igual ao userId) não corrige drift", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, lastActorId: "me" }));
    player().currentTime = 50;
    await driftTick();

    expect(player().getCurrentTime).not.toHaveBeenCalled();
    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("snapshot velho demais não arrasta o seguidor", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 6 * 60 * 1000 }));
    player().currentTime = 90;
    await driftTick();

    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("sem snapshot não corrige nada", async () => {
    await mount();
    player().currentTime = 90;
    await driftTick();

    expect(player().getCurrentTime).not.toHaveBeenCalled();
  });

  it("não corrige enquanto uma aplicação remota está pendente", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 20;
    player().setCurrentTime.mockReturnValueOnce(new Promise<void>(() => {}));
    remote({ type: "SEEK", time: 20 });
    await driftTick();

    expect(player().setCurrentTime).toHaveBeenCalledTimes(1);
  });

  it("a correção de drift não gera commit nem broadcast", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 20;
    await driftTick();

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useVimeoSync: ciclo de vida", () => {
  it("recarregar com player existente usa loadVideo sem criar outro", async () => {
    const hook = await mount();
    lb.video = videoOf("VIMEO", "999", 2);
    hook.rerender({});
    await flush();

    expect(FakeVimeo.instances).toHaveLength(1);
    expect(player().loadVideo).toHaveBeenCalledWith("999");
    expect(hook.result.current.isReady).toBe(true);
  });

  it("source diferente destrói o player e zera isReady", async () => {
    const hook = await mount();
    expect(hook.result.current.isReady).toBe(true);

    lb.video = videoOf("YOUTUBE", "abc");
    hook.rerender({});

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("video null destrói o player e zera isReady", async () => {
    const hook = await mount();
    lb.video = null;
    hook.rerender({});

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("voltar ao Vimeo depois de sair cria um player novo", async () => {
    const hook = await mount();
    lb.video = videoOf("YOUTUBE", "abc");
    hook.rerender({});
    lb.video = videoOf("VIMEO", "123456", 5);
    hook.rerender({});
    await flush();

    expect(FakeVimeo.instances).toHaveLength(2);
  });

  it("unmount destrói o player e reseta o relógio", async () => {
    const hook = await mount();
    setPlayback({ currentTime: 50, isPlaying: true, duration: 100 });
    hook.unmount();

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot()).toEqual({
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      volume: 1,
      isMuted: false,
      error: null,
    });
  });

  it("unmount antes do módulo carregar não cria player", async () => {
    const gate = deferred();
    mod.load.mockReturnValue(gate.promise.then(() => FakeVimeo));
    lb.video = videoOf("VIMEO", "123456");
    const hook = renderHook(() => useVimeoSync({ containerId: "vimeo", userId: "me" }));
    hook.unmount();
    gate.resolve();
    await flush();

    expect(FakeVimeo.instances).toHaveLength(0);
  });

  it("sem o container no DOM não cria player", async () => {
    document.body.innerHTML = "";
    await mount();

    expect(FakeVimeo.instances).toHaveLength(0);
  });
});

describe("useVimeoSync: controller", () => {
  it("expõe resolution do alvo e fpsLimit auto", async () => {
    const { result } = await mount({ targetResolution: "480p" });

    expect(result.current.controller.resolution).toBe("480p");
    expect(result.current.controller.fpsLimit).toBe("auto");
  });

  it("resolution padrão é 720p", async () => {
    const { result } = await mount();

    expect(result.current.controller.resolution).toBe("720p");
  });

  it("getters refletem a store de playback", async () => {
    const { result } = await mount();
    setPlayback({ currentTime: 3, duration: 9, isPlaying: true, volume: 0.2, isMuted: true });

    expect(result.current.controller).toMatchObject({
      currentTime: 3,
      duration: 9,
      isPlaying: true,
      volume: 0.2,
      isMuted: true,
    });
  });

  it("play e pause delegam ao player", async () => {
    const { result } = await mount();
    act(() => result.current.controller.play());
    act(() => result.current.controller.pause());

    expect(player().play).toHaveBeenCalledTimes(1);
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("togglePlay decide pelo estado da store", async () => {
    const { result } = await mount();
    act(() => result.current.controller.togglePlay());
    expect(player().play).toHaveBeenCalledTimes(1);

    setPlayback({ isPlaying: true });
    act(() => result.current.controller.togglePlay());
    expect(player().pause).toHaveBeenCalledTimes(1);
  });

  it("setVolume repassa o valor 0-1 e desmuta quando > 0", async () => {
    const { result } = await mount();
    setPlayback({ isMuted: true });
    act(() => result.current.controller.setVolume(0.5));

    expect(player().setVolume).toHaveBeenCalledWith(0.5);
    expect(player().setMuted).toHaveBeenCalledWith(false);
    expect(getPlaybackSnapshot()).toMatchObject({ volume: 0.5, isMuted: false });
  });

  it("setVolume 0 não desmuta", async () => {
    const { result } = await mount();
    setPlayback({ isMuted: true });
    act(() => result.current.controller.setVolume(0));

    expect(player().setVolume).toHaveBeenCalledWith(0);
    expect(player().setMuted).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isMuted).toBe(true);
  });

  it("toggleMute alterna pelo valor da store", async () => {
    const { result } = await mount();
    act(() => result.current.controller.toggleMute());
    expect(player().setMuted).toHaveBeenLastCalledWith(true);
    expect(getPlaybackSnapshot().isMuted).toBe(true);

    act(() => result.current.controller.toggleMute());
    expect(player().setMuted).toHaveBeenLastCalledWith(false);
    expect(getPlaybackSnapshot().isMuted).toBe(false);
  });

  it("sem player os controles são no-op e seek não emite", async () => {
    const hook = await mount();
    lb.video = null;
    hook.rerender({});
    const { controller } = hook.result.current;
    act(() => {
      controller.play();
      controller.pause();
      controller.togglePlay();
      controller.seek(5);
      controller.setVolume(0.5);
      controller.toggleMute();
    });

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useVimeoSync: erros", () => {
  it.each([
    ["Password required", "este vídeo é privado e exige senha."],
    ["The video does not exist", "vídeo não encontrado ou privado."],
    ["404", "vídeo não encontrado ou privado."],
    ["Embed privacy settings", "o dono deste vídeo não permite reprodução embutida."],
    ["domain not allowed", "o dono deste vídeo não permite reprodução embutida."],
    ["whatever", "não foi possível reproduzir este vídeo."],
  ])("evento error com %j mapeia a mensagem", async (raw, message) => {
    const { result } = await mount();
    fire("error", { message: raw });

    expect(result.current.error).toBe(message);
    expect(result.current.controller.error).toBe(message);
  });

  it("evento error sem message usa a mensagem genérica", async () => {
    const { result } = await mount();
    fire("error");

    expect(result.current.error).toBe("não foi possível reproduzir este vídeo.");
  });

  it("falha ao carregar o módulo do Vimeo vira erro e não cria player", async () => {
    mod.load.mockRejectedValue(new Error("chunk"));
    const { result } = await mount();

    expect(result.current.error).toBe("falha ao carregar o player do Vimeo. tente carregar o vídeo de novo.");
    expect(FakeVimeo.instances).toHaveLength(0);
  });

  it("loadVideo rejeitado mapeia o erro e não reaplica o snapshot", async () => {
    const hook = await mount();
    player().loadVideo.mockRejectedValueOnce(new Error("Password required"));
    player().setCurrentTime.mockClear();
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10 });
    lb.video = videoOf("VIMEO", "777", 3);
    hook.rerender({});
    await flush();

    expect(hook.result.current.error).toBe("este vídeo é privado e exige senha.");
    expect(player().setCurrentTime).not.toHaveBeenCalled();
  });

  it("recarregar com sucesso limpa o erro", async () => {
    const hook = await mount();
    fire("error", { message: "x" });
    expect(hook.result.current.error).not.toBeNull();

    lb.video = videoOf("VIMEO", "777", 2);
    hook.rerender({});
    await flush();

    expect(hook.result.current.error).toBeNull();
  });
});

describe("useVimeoSync: capQuality", () => {
  it("720p escolhe a maior qualidade <= 720 e ignora auto", async () => {
    await mount({ targetResolution: "720p" });

    expect(player().setQuality).toHaveBeenCalledTimes(1);
    expect(player().setQuality).toHaveBeenCalledWith("720p");
  });

  it("480p escolhe 360p, a maior abaixo do teto", async () => {
    await mount({ targetResolution: "480p" });

    expect(player().setQuality).toHaveBeenCalledWith("360p");
  });

  it("mudar targetResolution recalcula a qualidade", async () => {
    const hook = await mount({ targetResolution: "720p" });
    hook.rerender({ targetResolution: "480p" });
    await flush();

    expect(player().setQuality).toHaveBeenLastCalledWith("360p");
  });

  it("nenhuma qualidade elegível não chama setQuality", async () => {
    const hook = await mount();
    player().setQuality.mockClear();
    player().qualities = [{ id: "1080p", width: 1920, height: 1080 }];
    hook.rerender({ targetResolution: "480p" });
    await flush();

    expect(player().setQuality).not.toHaveBeenCalled();
  });

  it("falha em getQualities é engolida", async () => {
    const hook = await mount();
    player().getQualities.mockRejectedValueOnce(new Error("sem qualidades"));
    hook.rerender({ targetResolution: "480p" });

    await expect(flush()).resolves.toBeUndefined();
    expect(hook.result.current.error).toBeNull();
  });
});
