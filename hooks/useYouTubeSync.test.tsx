import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useYouTubeSync } from "./useYouTubeSync";
import { getPlaybackSnapshot, resetPlaybackClock, setPlayback } from "./usePlaybackClock";
import { lb, NOW, snapshotOf, videoOf } from "./__testutils__/liveblocksMock";

const api = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("@liveblocks/react", async () =>
  (await import("./__testutils__/liveblocksMock")).liveblocksModule(),
);
vi.mock("@/lib/youtube-iframe", () => ({ loadYouTubeIframeApi: api.load }));

type Events = {
  onReady: () => void;
  onStateChange: (e: { data: number }) => void;
  onError: (e: { data: number }) => void;
  onApiChange: () => void;
};

class FakePlayer {
  static instances: FakePlayer[] = [];
  currentTime = 0;
  duration = 100;
  volume = 100;
  muted = false;
  state = -1;
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  seekTo = vi.fn();
  destroy = vi.fn();
  loadVideoById = vi.fn();
  setVolume = vi.fn();
  unMute = vi.fn();
  mute = vi.fn();
  loadModule = vi.fn();
  unloadModule = vi.fn();
  setOption = vi.fn();
  constructor(
    public containerId: string,
    public opts: { videoId: string; events: Events },
  ) {
    FakePlayer.instances.push(this);
  }
  getCurrentTime() {
    return this.currentTime;
  }
  getDuration() {
    return this.duration;
  }
  getVolume() {
    return this.volume;
  }
  isMuted() {
    return this.muted;
  }
  getPlayerState() {
    return this.state;
  }
}

const PLAYING = 1;
const PAUSED = 2;

const player = () => FakePlayer.instances[0];

async function mount(props: { captions?: boolean } = {}) {
  lb.video = lb.video ?? videoOf("YOUTUBE", "abc123");
  const hook = renderHook((p: { captions?: boolean }) => useYouTubeSync({ containerId: "yt", userId: "me", ...p }), {
    initialProps: props,
  });
  await act(async () => {});
  return hook;
}

async function mountReady(props: { captions?: boolean } = {}) {
  const hook = await mount(props);
  act(() => player().opts.events.onReady());
  return hook;
}

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const stateChange = (data: number) => act(() => player().opts.events.onStateChange({ data }));

const remote = (overrides: Record<string, unknown> = {}) =>
  lb.emit({ type: "PLAY", time: 20, actorId: "other", ts: NOW + 10, source: "YOUTUBE", ...overrides });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  lb.reset();
  resetPlaybackClock();
  FakePlayer.instances = [];
  api.load.mockReset();
  api.load.mockResolvedValue(undefined);
  window.YT = { Player: FakePlayer, PlayerState: { PLAYING, PAUSED } } as unknown as typeof YT;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useYouTubeSync: ações locais", () => {
  it("play gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mountReady();
    player().currentTime = 12.5;
    stateChange(PLAYING);

    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 12.5, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PLAY",
      time: 12.5,
      source: "YOUTUBE",
      actorId: "me",
      ts: NOW,
    });
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("pause gera 1 commit e 1 broadcast com source e ts corretos", async () => {
    await mountReady();
    player().currentTime = 33;
    stateChange(PAUSED);

    expect(lb.commits).toEqual([{ isPlaying: false, currentTime: 33, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "PAUSE",
      time: 33,
      source: "YOUTUBE",
      actorId: "me",
      ts: NOW,
    });
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("estados que não são PLAYING/PAUSED não geram commit nem broadcast", async () => {
    await mountReady();
    stateChange(3);
    stateChange(0);

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("seek faz seekTo, atualiza o relógio e gera 1 commit e 1 broadcast", async () => {
    const { result } = await mountReady();
    player().state = PLAYING;
    act(() => result.current.controller.seek(45));

    expect(player().seekTo).toHaveBeenCalledWith(45, true);
    expect(getPlaybackSnapshot().currentTime).toBe(45);
    expect(lb.commits).toEqual([{ isPlaying: true, currentTime: 45, updatedAt: NOW, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "SEEK",
      time: 45,
      source: "YOUTUBE",
      actorId: "me",
      ts: NOW,
    });
  });

  it("seek com o player pausado commita isPlaying false", async () => {
    const { result } = await mountReady();
    player().state = PAUSED;
    act(() => result.current.controller.seek(8));

    expect(lb.commits[0]).toMatchObject({ isPlaying: false, currentTime: 8 });
  });

  it("seek emite mesmo dentro do cooldown de um evento remoto", async () => {
    const { result } = await mountReady();
    remote();
    act(() => result.current.controller.seek(60));

    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });
});

describe("useYouTubeSync: eventos remotos e eco", () => {
  it("PLAY remoto faz seekTo, playVideo e marca isPlaying", async () => {
    await mountReady();
    remote({ type: "PLAY", time: 20 });

    expect(player().seekTo).toHaveBeenCalledWith(20, true);
    expect(player().playVideo).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("PAUSE remoto faz seekTo, pauseVideo e desmarca isPlaying", async () => {
    await mountReady();
    setPlayback({ isPlaying: true });
    remote({ type: "PAUSE", time: 21 });

    expect(player().seekTo).toHaveBeenCalledWith(21, true);
    expect(player().pauseVideo).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("SEEK remoto só faz seekTo", async () => {
    await mountReady();
    remote({ type: "SEEK", time: 70 });

    expect(player().seekTo).toHaveBeenCalledWith(70, true);
    expect(player().playVideo).not.toHaveBeenCalled();
    expect(player().pauseVideo).not.toHaveBeenCalled();
  });

  it("ação local durante o cooldown não é emitida; depois do cooldown volta a ser", async () => {
    await mountReady();
    remote();

    stateChange(PLAYING);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(1499);
    stateChange(PAUSED);
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(1);
    stateChange(PAUSED);
    expect(lb.commits).toHaveLength(1);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
  });

  it("ação local dentro do cooldown é descartada e não chega aos outros", async () => {
    await mountReady();
    remote();
    tick(500);
    player().currentTime = 99;
    stateChange(PAUSED);

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
    stateChange(PAUSED);
    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();

    tick(900);
    stateChange(PAUSED);
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
    stateChange(PAUSED);

    expect(lb.broadcast).not.toHaveBeenCalled();
  });
});

describe("useYouTubeSync: eventos descartados", () => {
  it.each([
    ["actorId igual ao userId", { actorId: "me" }],
    ["source de outro player", { source: "VIMEO" }],
    ["payload sem type válido", { type: "LOAD_VIDEO" }],
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

    expect(player().seekTo).not.toHaveBeenCalled();
    expect(player().playVideo).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it.each([null, undefined, "PLAY", 42, [], {}])("descarta payload %j", async (payload) => {
    await mountReady();
    lb.emit(payload);

    expect(player().seekTo).not.toHaveBeenCalled();
  });

  it("descarta evento com ts <= ao último aplicado", async () => {
    await mountReady();
    remote({ ts: NOW + 100, time: 20 });
    tick(1500);
    remote({ ts: NOW + 100, time: 25 });
    remote({ ts: NOW + 50, time: 26 });

    expect(player().seekTo).toHaveBeenCalledTimes(1);
    expect(player().seekTo).toHaveBeenCalledWith(20, true);
  });

  it("descarta evento mais antigo que uma ação local recente", async () => {
    await mountReady();
    stateChange(PLAYING);
    remote({ ts: NOW - 1 });

    expect(player().seekTo).not.toHaveBeenCalled();
  });

  it("descarta evento remoto enquanto não há player", async () => {
    lb.video = videoOf("VIMEO", "123");
    await mount();
    remote();

    expect(FakePlayer.instances).toHaveLength(0);
  });
});

describe("useYouTubeSync: late join", () => {
  it("snapshot tocando: seek ao tempo esperado e playVideo", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();
    act(() => player().opts.events.onReady());

    expect(player().seekTo).toHaveBeenCalledWith(14, true);
    expect(player().playVideo).toHaveBeenCalledTimes(1);
    expect(player().pauseVideo).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(true);
  });

  it("snapshot pausado: seek ao currentTime e pauseVideo", async () => {
    lb.player = snapshotOf({ isPlaying: false, currentTime: 10, updatedAt: NOW - 4000 });
    await mount();
    act(() => player().opts.events.onReady());

    expect(player().seekTo).toHaveBeenCalledWith(10, true);
    expect(player().pauseVideo).toHaveBeenCalledTimes(1);
    expect(player().playVideo).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("snapshot velho demais é tratado como pausado", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 5 * 60 * 1000 - 1 });
    await mount();
    act(() => player().opts.events.onReady());

    expect(player().seekTo).toHaveBeenCalledWith(10, true);
    expect(player().pauseVideo).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isPlaying).toBe(false);
  });

  it("clampa o seek pela duração menos 0,5s", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 99, updatedAt: NOW - 4000 });
    await mount();
    player().duration = 100;
    act(() => player().opts.events.onReady());

    expect(player().seekTo).toHaveBeenCalledWith(99.5, true);
  });

  it("sem snapshot não faz seek nem play", async () => {
    await mountReady();

    expect(player().seekTo).not.toHaveBeenCalled();
    expect(player().playVideo).not.toHaveBeenCalled();
    expect(player().pauseVideo).not.toHaveBeenCalled();
  });

  it("onReady marca isReady e copia duração, volume e mute do player", async () => {
    await mount();
    player().duration = 200;
    player().volume = 40;
    player().muted = true;
    act(() => player().opts.events.onReady());

    expect(getPlaybackSnapshot()).toMatchObject({ duration: 200, volume: 0.4, isMuted: true });
  });

  it("late join não gera commit nem broadcast mesmo com ações nativas durante o cooldown", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW });
    await mount();
    act(() => player().opts.events.onReady());
    stateChange(PLAYING);

    expect(lb.commits).toEqual([]);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("compensa o skew do relógio do ator estimado por eventos anteriores", async () => {
    const hook = await mount();
    remote({ type: "SEEK", time: 1, ts: NOW + 2000 });
    lb.player = snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW + 2000 });
    hook.rerender({});
    act(() => player().opts.events.onReady());

    expect(player().seekTo).toHaveBeenLastCalledWith(10, true);
  });
});

describe("useYouTubeSync: drift", () => {
  async function readyWithSnapshot(snapshot: ReturnType<typeof snapshotOf>) {
    const hook = await mountReady();
    lb.player = snapshot;
    hook.rerender({});
    return hook;
  }

  it("seguidor fora do limiar faz seek ao tempo esperado", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 20;
    tick(3000);

    expect(player().seekTo).toHaveBeenCalledWith(13, true);
  });

  it("seguidor dentro do limiar de 3s não faz seek", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 15.5;
    tick(3000);

    expect(player().seekTo).not.toHaveBeenCalled();
  });

  it("dono (lastActorId igual ao userId) não corrige drift", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, lastActorId: "me" }));
    player().currentTime = 50;
    player().state = PLAYING;
    tick(3000);

    expect(player().seekTo).not.toHaveBeenCalled();
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("snapshot velho demais não arrasta o seguidor", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10, updatedAt: NOW - 6 * 60 * 1000 }));
    player().currentTime = 90;
    tick(3000);

    expect(player().seekTo).not.toHaveBeenCalled();
  });

  it("não corrige durante o cooldown de um evento remoto", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: true, currentTime: 10 }));
    player().currentTime = 20;
    tick(2900);
    remote({ type: "SEEK", time: 20 });
    tick(100);

    expect(player().seekTo).toHaveBeenCalledTimes(1);
    expect(player().seekTo).toHaveBeenCalledWith(20, true);
  });

  it("sem snapshot não corrige nada", async () => {
    await mountReady();
    player().currentTime = 90;
    tick(3000);

    expect(player().seekTo).not.toHaveBeenCalled();
  });

  it("dono pausado que mexeu no scrubber além de 2s emite SEEK por polling", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: false, currentTime: 10, lastActorId: "me" }));
    player().state = PAUSED;
    player().currentTime = 20;
    tick(3000);

    expect(lb.commits).toEqual([{ isPlaying: false, currentTime: 20, updatedAt: NOW + 3000, lastActorId: "me" }]);
    expect(lb.broadcast).toHaveBeenCalledTimes(1);
    expect(lb.broadcast).toHaveBeenCalledWith({
      type: "SEEK",
      time: 20,
      source: "YOUTUBE",
      actorId: "me",
      ts: NOW + 3000,
    });
  });

  it("dono pausado com desvio de até 2s não emite", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: false, currentTime: 10, lastActorId: "me" }));
    player().state = PAUSED;
    player().currentTime = 11.5;
    tick(3000);

    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("seguidor pausado fora do limiar também é puxado ao tempo esperado", async () => {
    await readyWithSnapshot(snapshotOf({ isPlaying: false, currentTime: 10 }));
    player().state = PAUSED;
    player().currentTime = 30;
    tick(3000);

    expect(player().seekTo).toHaveBeenCalledWith(10, true);
    expect(lb.broadcast).not.toHaveBeenCalled();
  });

  it("polling de 400ms atualiza currentTime e duration na store", async () => {
    await mountReady();
    player().currentTime = 7;
    player().duration = 150;
    tick(400);

    expect(getPlaybackSnapshot()).toMatchObject({ currentTime: 7, duration: 150 });
  });

  it("polling ignora exceção do player em estado transitório", async () => {
    await mountReady();
    player().getCurrentTime = () => {
      throw new Error("transitório");
    };

    expect(() => tick(400)).not.toThrow();
  });
});

describe("useYouTubeSync: ciclo de vida", () => {
  it("cria o player com o videoId e o containerId", async () => {
    await mount();

    expect(FakePlayer.instances).toHaveLength(1);
    expect(player().containerId).toBe("yt");
    expect(player().opts.videoId).toBe("abc123");
  });

  it("recarregar com player existente usa loadVideoById sem criar outro", async () => {
    const hook = await mountReady();
    lb.video = videoOf("YOUTUBE", "xyz789", 2);
    hook.rerender({});
    await act(async () => {});

    expect(FakePlayer.instances).toHaveLength(1);
    expect(player().loadVideoById).toHaveBeenCalledWith("xyz789");
  });

  it("source diferente destrói o player e zera isReady", async () => {
    const hook = await mountReady();
    expect(hook.result.current.isReady).toBe(true);

    lb.video = videoOf("VIMEO", "123");
    hook.rerender({});

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("video null destrói o player e zera isReady", async () => {
    const hook = await mountReady();
    lb.video = null;
    hook.rerender({});

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("voltar ao YouTube depois de sair cria um player novo", async () => {
    const hook = await mountReady();
    lb.video = videoOf("VIMEO", "123");
    hook.rerender({});
    lb.video = videoOf("YOUTUBE", "abc123", 5);
    hook.rerender({});
    await act(async () => {});

    expect(FakePlayer.instances).toHaveLength(2);
  });

  it("embedUrl vazio é tratado como saída da fonte", async () => {
    const hook = await mountReady();
    lb.video = { ...videoOf("YOUTUBE", "abc123"), embedUrl: null };
    hook.rerender({});

    expect(player().destroy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.isReady).toBe(false);
  });

  it("unmount destrói o player e reseta o relógio", async () => {
    const hook = await mountReady();
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

  it("unmount antes da API carregar não cria player", async () => {
    let release: () => void = () => {};
    api.load.mockReturnValue(new Promise<void>((resolve) => (release = resolve)));
    const hook = renderHook(() => useYouTubeSync({ containerId: "yt", userId: "me" }));
    lb.video = lb.video ?? videoOf("YOUTUBE", "abc123");
    hook.unmount();
    await act(async () => {
      release();
    });

    expect(FakePlayer.instances).toHaveLength(0);
  });
});

describe("useYouTubeSync: controller", () => {
  it("expõe resolution null e fpsLimit auto", async () => {
    const { result } = await mountReady();

    expect(result.current.controller.resolution).toBeNull();
    expect(result.current.controller.fpsLimit).toBe("auto");
  });

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

  it("play e pause delegam ao player", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.play());
    act(() => result.current.controller.pause());

    expect(player().playVideo).toHaveBeenCalledTimes(1);
    expect(player().pauseVideo).toHaveBeenCalledTimes(1);
  });

  it("togglePlay pausa quando a store diz que está tocando e toca quando não", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.togglePlay());
    expect(player().playVideo).toHaveBeenCalledTimes(1);

    setPlayback({ isPlaying: true });
    act(() => result.current.controller.togglePlay());
    expect(player().pauseVideo).toHaveBeenCalledTimes(1);
  });

  it("sem player os controles são no-op e seek não emite", async () => {
    const hook = await mountReady();
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

  it("setVolume converte para 0-100 e desmuta quando > 0", async () => {
    const { result } = await mountReady();
    setPlayback({ isMuted: true });
    act(() => result.current.controller.setVolume(0.5));

    expect(player().setVolume).toHaveBeenCalledWith(50);
    expect(player().unMute).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot()).toMatchObject({ volume: 0.5, isMuted: false });
  });

  it("setVolume 0 não desmuta", async () => {
    const { result } = await mountReady();
    setPlayback({ isMuted: true });
    act(() => result.current.controller.setVolume(0));

    expect(player().setVolume).toHaveBeenCalledWith(0);
    expect(player().unMute).not.toHaveBeenCalled();
    expect(getPlaybackSnapshot().isMuted).toBe(true);
  });

  it("toggleMute alterna entre mute e unMute pela store", async () => {
    const { result } = await mountReady();
    act(() => result.current.controller.toggleMute());
    expect(player().mute).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isMuted).toBe(true);

    act(() => result.current.controller.toggleMute());
    expect(player().unMute).toHaveBeenCalledTimes(1);
    expect(getPlaybackSnapshot().isMuted).toBe(false);
  });
});

describe("useYouTubeSync: erros", () => {
  it.each([
    [100, "vídeo não encontrado ou privado."],
    [101, "o dono deste vídeo não permite reprodução embutida (comum em vídeos com restrição de idade)."],
    [150, "o dono deste vídeo não permite reprodução embutida (comum em vídeos com restrição de idade)."],
    [2, "não foi possível reproduzir este vídeo."],
    [5, "não foi possível reproduzir este vídeo."],
  ])("onError %i mapeia a mensagem", async (code, message) => {
    const { result } = await mountReady();
    act(() => player().opts.events.onError({ data: code }));

    expect(result.current.error).toBe(message);
    expect(result.current.controller.error).toBe(message);
  });

  it("falha da API com Error anexa a dica de retentativa", async () => {
    api.load.mockRejectedValue(new Error("timeout carregando a API do YouTube."));
    const { result } = await mount();

    expect(result.current.error).toBe("timeout carregando a API do YouTube. tente carregar o vídeo de novo.");
    expect(FakePlayer.instances).toHaveLength(0);
  });

  it("falha da API sem Error usa a mensagem genérica", async () => {
    api.load.mockRejectedValue("boom");
    const { result } = await mount();

    expect(result.current.error).toBe("falha ao carregar o player do YouTube. tente carregar o vídeo de novo.");
  });

  it("novo load bem sucedido limpa o erro anterior", async () => {
    api.load.mockRejectedValueOnce(new Error("x."));
    const hook = await mount();
    expect(hook.result.current.error).not.toBeNull();

    lb.video = videoOf("YOUTUBE", "abc123", 2);
    hook.rerender({});
    await act(async () => {});

    expect(hook.result.current.error).toBeNull();
  });
});

describe("useYouTubeSync: legendas", () => {
  it("captions desligado: onReady descarrega o módulo e limpa a faixa", async () => {
    await mountReady({ captions: false });

    expect(player().unloadModule).toHaveBeenCalledWith("captions");
    expect(player().setOption).toHaveBeenCalledWith("captions", "track", {});
    expect(player().loadModule).not.toHaveBeenCalled();
  });

  it("captions ligado: carrega o módulo e não limpa a faixa", async () => {
    await mountReady({ captions: true });

    expect(player().loadModule).toHaveBeenCalledWith("captions");
    expect(player().unloadModule).not.toHaveBeenCalled();
    expect(player().setOption).not.toHaveBeenCalled();
  });

  it("virar a preferência em runtime reaplica sem recriar o player", async () => {
    const hook = await mountReady({ captions: false });
    hook.rerender({ captions: true });

    expect(player().loadModule).toHaveBeenCalledWith("captions");
    expect(FakePlayer.instances).toHaveLength(1);
  });

  it("onApiChange reaplica a preferência", async () => {
    await mountReady({ captions: true });
    player().loadModule.mockClear();
    act(() => player().opts.events.onApiChange());

    expect(player().loadModule).toHaveBeenCalledWith("captions");
  });

  it("PLAYING reforça a preferência de legenda", async () => {
    await mountReady({ captions: true });
    player().loadModule.mockClear();
    stateChange(PLAYING);

    expect(player().loadModule).toHaveBeenCalledWith("captions");
  });

  it("late join reforça a legenda de novo após 500ms", async () => {
    lb.player = snapshotOf({ isPlaying: true, currentTime: 1 });
    await mount({ captions: true });
    act(() => player().opts.events.onReady());
    player().loadModule.mockClear();
    tick(500);

    expect(player().loadModule).toHaveBeenCalledWith("captions");
  });
});
