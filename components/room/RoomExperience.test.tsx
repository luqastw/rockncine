import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScreenSharePresets, Track } from "livekit-client";
import { DEFAULT_BROADCAST_QUALITY } from "@/lib/broadcast-quality";
import type { BroadcastState } from "@/liveblocks.config";
import { appendChatItem, resetChatFeed } from "@/lib/chat-feed";

// O que este teste cobre: o gate do player. Com `storage.broadcast === null` a
// sala mostra o player normal; com o storage preenchido, `PlayerShell` e
// `PlayerControls` somem e entra a tela da transmissão (FR-004/FR-005,
// AC-001/AC-002).
//
// O que ele NÃO cobre, e o motivo de os módulos de mídia estarem mockados: os
// frames do SFU chegando, a captura real de tela e o áudio. `getDisplayMedia`
// e o `LiveKitRoom` não existem em jsdom — `MediaStreamTrack` nem
// `HTMLMediaElement.srcObject` têm comportamento que valha testar ali.

// `root` é o estado do storage que os seletores leem; `storage` é o proxy de
// escrita que o `useMutation` recebe. São coisas separadas no Liveblocks
// (seletor de leitura × `storage.set` de escrita) e separadas aqui também.
const mocks = vi.hoisted(() => {
  const root: { video: unknown; player: unknown; broadcast: unknown } = {
    video: null,
    player: null,
    broadcast: null,
  };
  const writes: [string, unknown][] = [];

  // O `Room` do Livekit, reduzido ao que o `BroadcastControls` usa: `on`/`off`
  // de evento. `emitir` é o que dispara `LocalTrackUnpublished` — o caminho de
  // FR-018, que não é testável pelo botão.
  const livekitRoom = {
    on: vi.fn(),
    off: vi.fn(),
    // `ConnectGate` chama `room.connect`; sem isto a promessa quebra e a sala
    // cai no caminho de erro.
    connect: vi.fn().mockResolvedValue(undefined),
  };

  return {
    root,
    writes,
    setScreenShareEnabled: vi.fn(),
    useTracksReturn: [] as unknown[],
    // contador de renders da presença (ver o mock de `PresenceList` abaixo)
    presenceRenders: { n: 0 },
    livekitRoom,
    emitirLiveKitRoom: (evento: string, payload: unknown) => {
      for (const call of livekitRoom.on.mock.calls) {
        if (call[0] === evento) call[1](payload);
      }
    },
    // Espelho do storage do Liveblocks, o bastante para o `storage.set` do
    // `useMutation` não explodir. As escritas em si não são o que este teste
    // verifica — quem valida a forma do estado é `lib/broadcast.test.ts`.
    storage: {
      get: (key: string) => root[key as keyof typeof root],
      set: (key: string, value: unknown) => {
        writes.push([key, value]);
        root[key as keyof typeof root] = value;
      },
      update: (patch: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(patch)) {
          writes.push([key, value]);
          root[key as keyof typeof root] = value;
        }
      },
    },
    // Saúde do SFU: `auth` é o estado da credencial (veja o contexto em
    // LiveKitProvider) e `connection` é o estado do WebSocket. O botão só
    // habilita com os dois em `ready`/`connected`, e cada combinação tem uma
    // mensagem própria — que é o que torna erro de configuração diagnosticável
    // sem DevTools.
    auth: { status: "ready" } as Record<string, unknown>,
    // Motivo da falha de conexão, quando o `ConnectGate` capturou um.
    failure: null as Record<string, unknown> | null,
    connection: "connected" as string,

    // Vive no `vi.hoisted` porque as factories de `vi.mock` são içadas acima
    // dos `const` do módulo: um controller declarado aqui fora seria acessado
    // antes da inicialização.
    controller: {
      isReady: true,
      isPlaying: true,
      currentTime: 10,
      duration: 100,
      volume: 1,
      isMuted: false,
      error: null,
      resolution: null,
      fpsLimit: "auto",
      play: vi.fn(),
      pause: vi.fn(),
      togglePlay: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      toggleMute: vi.fn(),
    },
  };
});

vi.mock("@liveblocks/react", () => ({
  useStorage: (selector: (root: Record<string, unknown>) => unknown) => selector(mocks.root),
  // `useOthers` aceita seletor opcional: `RoomExperience` passa um, o
  // `LastActionNote` não passa nenhum.
  useOthers: (selector?: (others: unknown[]) => unknown) => (selector ? selector([]) : []),
  useStatus: () => "connected",
  // O `useMutation` real é estável por `deps` e injeta o contexto de mutação
  // como primeiro argumento. A imitação precisa das duas coisas: o
  // `BroadcastControls` depende da estabilidade (o cleanup do efeito de saída
  // roda `clearBroadcast`, e uma referência nova a cada render limparia o
  // storage no primeiro passe) e o `storage.set` precisa existir para o
  // callback não estourar quando o efeito dispara.
  //
  // `useCallback` com `deps` não literal é o que o pacote real faz, e o
  // `react-hooks` não consegue verificar isso estaticamente — daí o disable
  // dos dois diagnósticos, e não de todos.
  useMutation: (callback: (ctx: unknown, ...args: unknown[]) => unknown, deps: unknown[]) =>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback((...args: unknown[]) => callback({ storage: mocks.storage }, ...args), deps),
  useBroadcastEvent: () => vi.fn(),
  useEventListener: () => {},
  // Tupla: presença E atualizador. O `Chat` real chama o segundo para marcar
  // digitação, e um mock com um elemento só quebra em tempo de digitação, não
  // no render.
  useMyPresence: () => [{ userId: "eu", name: "ana" }, vi.fn()],
}));

// Os três hooks de sync devolvem um `controller` sempre presente (é o contrato
// de `PlaybackController`), então o mock entrega um controller pronto. É ele que
// faz `PlayerShell` montar a barra de controles — o marcador de "modo player"
// que AC-001 e AC-002 pedem.
vi.mock("@/hooks/useYouTubeSync", () => ({
  useYouTubeSync: () => ({ isReady: true, error: null, controller: mocks.controller }),
}));
vi.mock("@/hooks/useVimeoSync", () => ({
  useVimeoSync: () => ({ isReady: true, error: null, controller: mocks.controller }),
}));
vi.mock("@/hooks/useNativeVideoSync", () => ({
  useNativeVideoSync: () => ({ isReady: true, error: null, controller: mocks.controller }),
}));
vi.mock("@/hooks/useLastRoomEvent", () => ({ useLastRoomEvent: () => null }));
vi.mock("@/hooks/useRoomJoinAnnouncement", () => ({ useRoomJoinAnnouncement: () => {} }));
vi.mock("@/hooks/useRoomLeaveAnnouncement", () => ({ useRoomLeaveAnnouncement: () => {} }));
// O `Chat` aqui é o de verdade: o isolamento de render que a spec 13 exige
// (FR-002, AC-001) só pode ser medido com o log real montado dentro da sala.
// Já a presença é substituída por um CONTADOR de renders: ela é o componente
// "fora do log" que a mensagem de chat não pode acordar.
vi.mock("@/components/room/PresenceList", () => ({
  PresenceTrigger: () => {
    mocks.presenceRenders.n += 1;
    return <div data-testid="presence-trigger" />;
  },
  PresenceList: () => <div data-testid="presence" />,
  usePresenceDisclosure: () => ({ expanded: false, toggle: () => {} }),
}));

vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTracks: () => mocks.useTracksReturn,
  useLocalParticipant: () => ({
    localParticipant: { setScreenShareEnabled: mocks.setScreenShareEnabled },
  }),
  // `on`/`off` registrados para o teste poder disparar `LocalTrackUnpublished`
  // e exercitar FR-018.
  useMaybeRoomContext: () => mocks.livekitRoom,
  useConnectionState: () => mocks.connection,
}));

// O `RoomExperience` é renderizado direto aqui, sem o `LiveKitProvider` acima —
// então o contexto de auth cai no valor padrão (`disabled`) e o botão ficaria
// desabilitado em todos os testes. `ready` é o estado saudável e é o que os
// testes que não falam de configuração precisam.
vi.mock("@/components/room/LiveKitProvider", () => ({
  useLiveKitAuth: () => mocks.auth,
  useLiveKitFailure: () => mocks.failure,
}));

import { RoomExperience, type VideoQuality } from "./RoomExperience";

const VIDEO = {
  source: "YOUTUBE" as const,
  embedUrl: "dQw4w9WgXcQ",
  sourceUrl: "https://youtu.be/dQw4w9WgXcQ",
  loadedAt: 1,
};

const PLAYER = { isPlaying: true, currentTime: 10, updatedAt: Date.now(), lastActorId: "outro" };

const broadcast: BroadcastState = {
  broadcasterId: "outro",
  broadcasterName: "bruno",
  startedAt: Date.now(),
  heartbeatAt: Date.now(),
};

// `RoomExperience` recebe `videoQuality` por prop, então este teste monta o
// objeto em vez de chamar o hook — e o `RoomExperience` é o único consumidor
// dele, o que torna esse o contrato estável da prop.
const quality: VideoQuality = {
  resolution: "720p",
  fpsLimit: "auto",
  economyMode: false,
  setResolution: vi.fn(),
  setEconomyMode: vi.fn(),
  setFpsLimit: vi.fn(),
  isLowEnd: false,
  isSafari: false,
  hasSeenSuggestion: true,
  dismissSuggestion: vi.fn(),
  captions: false,
  setCaptions: vi.fn(),
};

// O tipo explícito importa: com o default inferido, passar `livekitUrl: null`
// seria um erro de tipo, e é exatamente o caso de degradação que este arquivo
// precisa exercitar.
function renderRoom({ livekitUrl = "wss://teste.livekit.cloud" }: { livekitUrl?: string | null } = {}) {
  return render(
    <RoomExperience
      roomCode="SALA1234"
      roomName="sala"
      userId="eu"
      userName="ana"
      videoQuality={quality}
      livekitUrl={livekitUrl ?? null}
    />,
  );
}

// Clica em "iniciar transmissão" e devolve as options que chegaram no
// `setScreenShareEnabled` — que é onde as constraints e o preset de qualidade
// viram observáveis. No escopo do módulo porque tanto as constraints de captura
// quanto a qualidade precisam dela.
async function iniciar() {
  vi.stubGlobal("open", vi.fn());
  mocks.setScreenShareEnabled.mockResolvedValue({});
  renderRoom();
  fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));
  await waitFor(() => expect(mocks.setScreenShareEnabled).toHaveBeenCalled());
  return mocks.setScreenShareEnabled.mock.calls[0][1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  // A qualidade vive em localStorage (preferência do host). Sem limpar, um teste
  // que escolha "alta" contamina o seguinte pelo store de módulo.
  localStorage.clear();
  Object.assign(mocks.root, { video: VIDEO, player: PLAYER, broadcast: null });
  mocks.writes.length = 0;
  mocks.useTracksReturn = [];
  mocks.presenceRenders.n = 0;
  mocks.auth = { status: "ready" };
  mocks.connection = "connected";
  mocks.failure = null;
  // jsdom não implementa `mediaDevices` nem `getDisplayMedia`; o botão depende
  // dele existir (FR-010). O comportamento de captura de verdade — o seletor do
  // SO, a `MediaStream` real — não é testável aqui, e este stub existe só para
  // o caminho de renderização ser alcançado.
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: { getDisplayMedia: () => Promise.resolve({}) },
  });
});

// O `DOMException` que o `getDisplayMedia` produz quando o usuário dispensa o
// seletor ou nega a permissão. O Livekit normaliza os dois nomes antigos
// (`PermissionDeniedError`, `PermissionDismissedError`) para este (ver o shim
// em `createScreenTracks` no bundle dele), então `NotAllowedError` é a
// fronteira confiável entre cancelamento e falha de publicação.
function negado() {
  const error = new Error("Permission denied");
  error.name = "NotAllowedError";
  return error;
}

function removeDisplayMedia() {
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: {},
  });
}

describe("área de vídeo — modo player (FR-005, AC-001)", () => {
  it("AC-001: com broadcast null existe o player normal e nenhum elemento de transmissão", () => {
    renderRoom();

    // O botão de play/pause do `PlayerControls` é o marcador mais preciso de
    // que a barra de controles está montada.
    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
    expect(screen.queryByText("conectando à transmissão")).toBeNull();
    expect(screen.queryByText("transmitindo")).toBeNull();
  });

  it("sala sem vídeo mostra o estado de nenhum vídeo carregado", () => {
    mocks.root.video = { source: null, embedUrl: null, sourceUrl: null, loadedAt: null };

    renderRoom();

    expect(screen.getByText("nenhum vídeo carregado")).toBeTruthy();
  });
});

describe("área de vídeo — modo transmissão (FR-004, AC-002)", () => {
  it("AC-002: com broadcast preenchido o PlayerControls some e a transmissão assume", () => {
    mocks.root.broadcast = broadcast;

    renderRoom();

    // O botão de play/pause é exatamente o que AC-002 nomeia.
    expect(screen.queryByRole("button", { name: /pausar|tocar/ })).toBeNull();
    expect(screen.queryByRole("slider", { name: "progresso do vídeo" })).toBeNull();
    expect(screen.getByText("conectando à transmissão")).toBeTruthy();
    expect(screen.getByText("bruno")).toBeTruthy();
  });

  it("AC-009: broadcast malformado não tira a sala do modo player", () => {
    // `broadcasterName` como objeto é o vetor que quebraria o React da sala
    // inteira se o valor fosse repassado para a tela.
    mocks.root.broadcast = { ...broadcast, broadcasterName: { first: "bruno" } };

    renderRoom();

    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
    expect(screen.queryByText("conectando à transmissão")).toBeNull();
  });

  // O heartbeat parado é o que expira — não o `startedAt`. Um host que transmite
  // há horas sem morrer tem `startedAt` antigo e `heartbeatAt` recente, e a sala
  // tem que continuar no modo transmissão.
  it("sessão longa com heartbeat vivo continua no modo transmissão", () => {
    const agora = Date.now();
    mocks.root.broadcast = {
      ...broadcast,
      startedAt: agora - 3 * 60 * 60 * 1000,
      heartbeatAt: agora - 20_000,
    };

    renderRoom();

    expect(screen.getByText("conectando à transmissão")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pausar|tocar/ })).toBeNull();
  });

  it("broadcast com heartbeat parado (transmissor que sumiu) devolve ao player normal", () => {
    mocks.root.broadcast = { ...broadcast, heartbeatAt: Date.now() - 60 * 60 * 1000 };

    renderRoom();

    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
  });

  it("o único <video> da tela é o da transmissão, com playsInline, autoPlay e muted", () => {
    mocks.root.broadcast = broadcast;

    renderRoom();

    // `<video>` é o marcador de que o `PlayerShell` — que é quem cria o
    // container do backend ativo — não está montado. `muted` é obrigatório:
    // sem ele o browser bloqueia o autoplay e o espectador vê um quadro
    // congelado (FR-012).
    const videos = document.querySelectorAll("video");
    expect(videos).toHaveLength(1);
    expect(videos[0].getAttribute("autoplay")).not.toBeNull();
    expect(videos[0].getAttribute("playsinline")).not.toBeNull();
    expect((videos[0] as HTMLVideoElement).muted).toBe(true);
  });
});

describe("botão de transmissão (FR-009, FR-010, AC-004, AC-005)", () => {
  it("AC-005: sem getDisplayMedia o botão não existe", () => {
    removeDisplayMedia();

    renderRoom();

    expect(screen.queryByRole("button", { name: /transmissão de tela/ })).toBeNull();
  });

  it("AC-004: com outra pessoa transmitindo, o botão existe desabilitado e diz quem", () => {
    mocks.root.broadcast = broadcast;

    renderRoom();

    const button = screen.getByRole("button", { name: "já há alguém transmitindo" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("bruno está transmitindo")).toBeTruthy();
  });

  it("sem transmissão, o botão está habilitado e é o de iniciar", () => {
    renderRoom();

    const button = screen.getByRole("button", { name: "iniciar transmissão de tela" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("o próprio transmissor vê o botão de parar, não o de iniciar", () => {
    mocks.root.broadcast = { ...broadcast, broadcasterId: "eu" };

    renderRoom();

    expect(screen.getByRole("button", { name: "parar transmissão" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "iniciar transmissão de tela" })).toBeNull();
  });
});

describe("iniciar transmissão (FR-006, FR-007, FR-008)", () => {
  it("FR-006: abre a URL do vídeo em nova aba antes de pedir a captura", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    mocks.setScreenShareEnabled.mockResolvedValue({});
    const ordem: string[] = [];
    open.mockImplementation(() => ordem.push("open"));
    mocks.setScreenShareEnabled.mockImplementation(() => {
      ordem.push("captura");
      return Promise.resolve({});
    });

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));
    await waitFor(() => expect(ordem).toHaveLength(2));

    expect(open).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener");
    // A ordem importa: o seletor do SO precisa ter o que escolher.
    expect(ordem).toEqual(["open", "captura"]);
    vi.unstubAllGlobals();
  });

  it("FR-007: permissão concedida grava o transmissor no storage", async () => {
    vi.stubGlobal("open", vi.fn());
    mocks.setScreenShareEnabled.mockResolvedValue({});

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));

    await waitFor(() => {
      const write = mocks.writes.find(([key]) => key === "broadcast");
      expect(write?.[1]).toMatchObject({ broadcasterId: "eu", broadcasterName: "ana" });
    });
    vi.unstubAllGlobals();
  });

  // FR-008: o storage não é tocado e a UI volta ao estado anterior com aviso.
  // Sem isto, um cancelamento deixaria a sala presa em "modo transmissão"
  // mostrando um player vazio para todo mundo.
  it("FR-008: permissão negada não grava nada e avisa", async () => {
    vi.stubGlobal("open", vi.fn());
    // `name`, não mensagem: o `getDisplayMedia` rejeita com `DOMException` cujo
    // `name` é `NotAllowedError`, e é esse campo que separa "usuário cancelou"
    // de "a publicação falhou". Um `new Error("NotAllowedError")` teria `name`
    // igual a "Error" e cairia no ramo errado — o teste precisa usar o formato
    // real para estar exercitando o discriminate.
    mocks.setScreenShareEnabled.mockRejectedValue(negado());

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));

    expect(
      await screen.findByText("a captura de tela foi cancelada ou negada."),
    ).toBeTruthy();
    expect(mocks.writes.some(([key]) => key === "broadcast")).toBe(false);
    // O player continua no lugar: a sala não mudou de modo.
    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe("áudio da transmissão (FR-013, FR-016, AC-006, AC-010)", () => {
  it("AC-006: só a track de vídeo chegou — o vídeo toca e há aviso de áudio ausente", () => {
    mocks.root.broadcast = broadcast;
    mocks.useTracksReturn = [
      screenShareRef("outro", Track.Source.ScreenShare, fakeTrack(() => {})),
    ];

    renderRoom();

    expect(document.querySelector("video")).toBeTruthy();
    expect(screen.getByText(/esta transmissão está sem áudio/i)).toBeTruthy();
  });

  it("com as duas tracks, nenhum aviso de áudio", () => {
    mocks.root.broadcast = broadcast;
    mocks.useTracksReturn = [
      screenShareRef("outro", Track.Source.ScreenShare, fakeTrack(() => {})),
      screenShareRef("outro", Track.Source.ScreenShareAudio, fakeTrack(() => {})),
    ];

    renderRoom();

    expect(screen.queryByText(/sem áudio/i)).toBeNull();
  });

  // O aviso só vale depois que a track de vídeo existe: antes disso, "sem
  // áudio" seria uma afirmação que ninguém pode verificar — o storage já diz
  // que há transmissão, mas os frames ainda estão a caminho.
  it("sem track de vídeo ainda, o aviso de áudio não aparece", () => {
    mocks.root.broadcast = broadcast;
    mocks.useTracksReturn = [];

    renderRoom();

    expect(screen.getByText("conectando à transmissão")).toBeTruthy();
    expect(screen.queryByText(/sem áudio/i)).toBeNull();
  });
});

describe("anexação da track ao elemento (FR-011, FR-012)", () => {
  // O storage é a autoridade sobre QUEM transmite, e a identidade do Livekit é
  // o mesmo `userId`. Com duas telas na sala, a do transmissor declarado é a
  // que vai para o `<video>`.
  it("a track do transmissor declarado tem prioridade sobre a de outro", () => {
    mocks.root.broadcast = broadcast;
    const anexados: Element[] = [];
    const doOutro = screenShareRef("outro", Track.Source.ScreenShare, fakeTrack((el) => anexados.push(el)));
    const doTerceiro = screenShareRef("terceiro", Track.Source.ScreenShare, fakeTrack((el) => anexados.push(el)));
    // O transmissor declarado por último de propósito: a busca não pode
    // simplesmente pegar a primeira.
    mocks.useTracksReturn = [doTerceiro, doOutro];

    renderRoom();

    expect(anexados).toHaveLength(1);
    expect(anexados[0]).toBeInstanceOf(HTMLVideoElement);
  });

  it("o áudio vai para o <audio>, nunca para o <video>", () => {
    mocks.root.broadcast = broadcast;
    const anexados: string[] = [];
    const video = screenShareRef("outro", Track.Source.ScreenShare, fakeTrack((el) => anexados.push(el.tagName)));
    const audio = screenShareRef("outro", Track.Source.ScreenShareAudio, fakeTrack((el) => anexados.push(el.tagName)));
    mocks.useTracksReturn = [video, audio];

    renderRoom();

    expect(anexados).toEqual(["VIDEO", "AUDIO"]);
  });
});

// `useTracks` devolve referências com `participant`, `source` e `publication`.
// Só o que `ScreenSharePlayer` lê. `track` é `null` quando a publicação ainda
// não foi assinada — por isso o tipo é `unknown` e o teste preenche quando
// quer exercitar o `attach`.
//
// `Track.Source` vem do pacote real (não de mock): os valores do enum são
// strings específicas (`screen_share`, `screen_share_audio`) e o
// `ScreenSharePlayer` compara por igualdade — um literal inventado aqui
// passaria como "nenhuma track encontrada" e o teste viraria vacuidade.
function screenShareRef(
  identity: string,
  source: Track.Source,
  track: unknown = null,
  // `isLocal` decide se o áudio toca para quem está olhando. O padrão é remoto
  // (espectador); o host vê a própria track como local.
  isLocal = false,
) {
  return {
    participant: { identity, isLocal },
    source,
    publication: { source, track, isMuted: false, trackSid: `${identity}-${source}` },
  };
}

// `MediaStreamTrack` real não existe em jsdom; o que importa aqui é qual
// elemento a track foi anexada, e o `ScreenSharePlayer` só chama `attach`/`detach`.
function fakeTrack(registrar: (element: Element) => void) {
  return {
    attach: (element: Element) => {
      registrar(element);
      return element;
    },
    detach: vi.fn(),
  };
}

describe("encerramento (FR-017, FR-018, FR-019)", () => {
  it("FR-017: parar transmissão desliga a track e zera o storage", () => {
    mocks.root.broadcast = { ...broadcast, broadcasterId: "eu" };
    mocks.setScreenShareEnabled.mockResolvedValue(undefined);

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "parar transmissão" }));

    expect(mocks.setScreenShareEnabled).toHaveBeenCalledWith(false);
    expect(mocks.writes).toContainEqual(["broadcast", null]);
  });

  // FR-018: revogação de permissão pelo SO, fim da aba compartilhada, crash —
  // todos chegam pelo mesmo evento, e o caminho tem de ser o do botão, senão a
  // sala fica presa em "modo transmissão" com um player vazio para todo mundo.
  it("FR-018: track do transmissor despublicada limpa o storage", () => {
    mocks.root.broadcast = { ...broadcast, broadcasterId: "eu" };
    mocks.setScreenShareEnabled.mockResolvedValue(undefined);

    renderRoom();
    mocks.emitirLiveKitRoom("localTrackUnpublished", {
      source: Track.Source.ScreenShare,
    });

    expect(mocks.setScreenShareEnabled).toHaveBeenCalledWith(false);
    expect(mocks.writes).toContainEqual(["broadcast", null]);
  });

  it("track de outro despublicada não mexe no estado", () => {
    mocks.root.broadcast = { ...broadcast, broadcasterId: "eu" };

    renderRoom();
    mocks.emitirLiveKitRoom("localTrackUnpublished", { source: Track.Source.Camera });

    expect(mocks.writes).not.toContainEqual(["broadcast", null]);
  });

  it("FR-019: quem não é transmissor não limpa o storage de quem é", () => {
    mocks.root.broadcast = broadcast;

    renderRoom();
    mocks.emitirLiveKitRoom("localTrackUnpublished", { source: Track.Source.ScreenShare });

    expect(mocks.writes).not.toContainEqual(["broadcast", null]);
  });
});

describe("degradação sem SFU configurado", () => {
  it("sem LIVEKIT_URL o botão de transmissão não renderiza", () => {
    renderRoom({ livekitUrl: null });

    expect(screen.queryByRole("button", { name: /transmissão/ })).toBeNull();
    // O modo player segue inteiro — a sala não depende do Livekit.
    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
  });

  // O storage sobrevive à queda do Livekit — é ele que sobrevive. Um cliente
  // sem wrapper recebendo `broadcast !== null` e montando o `ScreenSharePlayer`
  // derrubaria o React da sala inteira no `useTracks`, que exige o contexto de
  // room. O modo player é o estado correto aí.
  it("broadcast no storage mas sem Livekit: modo player, sem crash", () => {
    mocks.root.broadcast = broadcast;

    renderRoom({ livekitUrl: null });

    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
    expect(screen.queryByText("conectando à transmissão")).toBeNull();
  });
});

// As constraints de captura não são detalhe de implementação: cada uma delas
// fecha um modo de falha que só aparece com duas pessoas reais na sala. O
// Livekit repassa `options` literal para o `getDisplayMedia`
// (`screenCaptureToDisplayMediaStreamOptions` no bundle dele), então verificar
// o que chega em `setScreenShareEnabled` é verificar o que chega no SO.
describe("constraints de captura (FR-006, FR-015)", () => {
  // O SALÃO DE MIRROR. Sem isto, o seletor oferece a aba da própria sala e quem
  // compartilha a sala transmite a sala — recursivamente, com o atraso do SFU
  // a cada geração. O espectador assiste uma sala se multiplicando, e o host
  // que tentou compartilhar um vídeo está transmitindo o produto inteiro.
  it('impede o compartilhamento da própria aba: selfBrowserSurface "exclude"', async () => {
    const options = await iniciar();
    expect(options.selfBrowserSurface).toBe("exclude");
    vi.unstubAllGlobals();
  });

  // "com som" só existe se o seletor oferecer a caixa de áudio. A constraint é
  // o que garante que a opção apareça — o requisito do usuário não sobrevive
  // sem ela.
  it('expõe a captura de áudio no seletor: systemAudio "include"', async () => {
    const options = await iniciar();
    expect(options.systemAudio).toBe("include");
    expect(options.audio).toBe(true);
    vi.unstubAllGlobals();
  });

  // Trocar o que está sendo transmitido pela UI do Chrome sem derrubar a
  // transmissão. É o que sustenta "vídeo rola em outra aba" quando a sessão
  // muda de filme.
  it('permite trocar a aba compartilhada: surfaceSwitching "include"', async () => {
    const options = await iniciar();
    expect(options.surfaceSwitching).toBe("include");
    vi.unstubAllGlobals();
  });

  // `detail` manda o encoder preservar detalhe AO CUSTO da taxa de quadros — foi
  // feito para texto e arte vetorial. Para vídeo é o oposto do que serve, e foi o
  // que fez a transmissão parecer travada: o encoder segurava nitidez e dropping
  // frames. O próprio Livekit força `motion` em screen share porque o caminho
  // `detail` é "untested/buggy".
  it("marca o conteúdo como motion, nunca detail", async () => {
    const options = await iniciar();
    expect(options.contentHint).toBe("motion");
    expect(options.contentHint).not.toBe("detail");
    vi.unstubAllGlobals();
  });

  // Sem `resolution` explícito o Livekit usa `ScreenSharePresets.h1080fps30`:
  // 1920x1080 a 5 Mbps de upstream, que em banda residencial vira frames
  // descartados — exatamente o sintoma que se quer eliminar.
  it("envia o preset da qualidade escolhida, não o default de 5 Mbps", async () => {
    const options = await iniciar();
    expect(options.resolution).toBe(ScreenSharePresets.h720fps30);
    vi.unstubAllGlobals();
  });
});

describe("qualidade da transmissão", () => {
  it("o padrão é 720p30, 40% da banda do default do Livekit", () => {
    expect(DEFAULT_BROADCAST_QUALITY).toBe("normal");
    // `maxBitrate` e `maxFramerate` vivem dentro de `encoding`, não no topo do preset.
    expect(ScreenSharePresets.h1080fps30.encoding.maxBitrate).toBe(5_000_000);
    expect(ScreenSharePresets.h720fps30.encoding.maxBitrate).toBe(2_000_000);
    expect(ScreenSharePresets.h720fps30.encoding.maxFramerate).toBe(30);
  });

  it("escolher qualidade muda o preset da próxima transmissão", async () => {
    localStorage.setItem("rockncine-broadcast-quality", "alta");

    const options = await iniciar();

    expect(options.resolution).toBe(ScreenSharePresets.h1080fps30);
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // Valor corrompido no localStorage não pode virar `undefined` em
  // `BROADCAST_QUALITIES[...]` — um crash na hora de transmitir.
  it("qualidade corrompida no storage cai no padrão", async () => {
    localStorage.setItem("rockncine-broadcast-quality", '{"level":"alta"}');

    const options = await iniciar();

    expect(options.resolution).toBe(ScreenSharePresets.h720fps30);
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("o seletor mostra as três opções", () => {
    renderRoom();

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "baixa",
      "normal",
      "alta",
    ]);
  });

  // A track já foi criada com o preset escolhido; trocar exigiria republicar, o
  // que derrubaria a transmissão no meio do filme. O motivo fica nomeado.
  it("transmitindo, o seletor desabilita e diz que vale para a próxima", () => {
    mocks.root.broadcast = { ...broadcast, broadcasterId: "eu" };

    renderRoom();

    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(
      screen.getByRole("combobox", { name: /próxima transmissão/i }),
    ).toBeTruthy();
  });
});

describe("escotilha quando os quadros não chegam", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('diz "conectando" enquanto há prazo, e nunca antes de o prazo', () => {
    mocks.root.broadcast = broadcast;

    renderRoom();
    act(() => vi.advanceTimersByTime(11_000));

    expect(screen.getByText("conectando à transmissão")).toBeTruthy();
    expect(screen.queryByText("a transmissão não chegou")).toBeNull();
  });

  it('passado o prazo, diz que NÃO chegou e oferece voltar ao player', () => {
    mocks.root.broadcast = broadcast;

    renderRoom();
    act(() => vi.advanceTimersByTime(12_000));

    expect(screen.queryByText("conectando à transmissão")).toBeNull();
    expect(screen.getByText("a transmissão não chegou")).toBeTruthy();
    expect(screen.getByRole("button", { name: "voltar ao player" })).toBeTruthy();
  });

  // A queda é manual e LOCAL: quem assiste deixa de esperar, sem cancelar a
  // transmissão de outra pessoa. Mexer no storage aqui seria tomar uma decisão
  // que não é dele — e o storage continua dizendo que há transmissão, então se
  // os quadros voltarem, a sala volta sozinha.
  it("voltar ao player é local: não encerra a transmissão de quem transmite", () => {
    mocks.root.broadcast = broadcast;

    renderRoom();
    act(() => vi.advanceTimersByTime(12_000));
    fireEvent.click(screen.getByRole("button", { name: "voltar ao player" }));

    expect(screen.getByRole("button", { name: /pausar|tocar/ })).toBeTruthy();
    expect(mocks.writes).toHaveLength(0);
  });

  // A escotilha se refere a UMA transmissão. Uma transmissão nova — mesmo
  // transmissor — é outra espera, e não pode herdar a espera vencida.
  it("uma transmissão nova recomeça a espera do zero", () => {
    mocks.root.broadcast = broadcast;

    const { rerender } = renderRoom();
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByText("a transmissão não chegou")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "voltar ao player" }));
    mocks.root.broadcast = { ...broadcast, startedAt: broadcast.startedAt + 1 };
    rerender(
      <RoomExperience
        roomCode="SALA1234"
        roomName="sala"
        userId="eu"
        userName="ana"
        videoQuality={quality}
        livekitUrl="wss://teste.livekit.cloud"
      />,
    );

    expect(screen.getByText("conectando à transmissão")).toBeTruthy();
  });

  // Se os quadros chegarem, a espera termina e o player de transmissão assume.
  // Sem isto, o espectador ficaria vendo "não chegou" por cima de um vídeo que
  // está tocando.
  it("com a track presente, nenhuma das duas mensagens de espera aparece", () => {
    mocks.root.broadcast = broadcast;
    mocks.useTracksReturn = [
      screenShareRef("outro", Track.Source.ScreenShare, fakeTrack(() => {})),
      screenShareRef("outro", Track.Source.ScreenShareAudio, fakeTrack(() => {})),
    ];

    renderRoom();
    act(() => vi.advanceTimersByTime(12_000));

    expect(screen.queryByText("conectando à transmissão")).toBeNull();
    expect(screen.queryByText("a transmissão não chegou")).toBeNull();
  });
});

// A falha que aconteceu na primeira tentativa em produção: a captura foi
// concedida pelo SO (o banner do browser ficou ligado), a publicação no SFU
// falhou porque a room não existia, e o `catch` genérico acusou o usuário de
// ter cancelado. Quem lê isso não tem como saber que era deploy mal configurado.
//
// Estes testes fixam as quatro propriedades que corrigem isso.
describe("saúde do SFU antes de pedir captura", () => {
  it("sem credencial (503), o botão desabilita e diz que é configuração do deploy", () => {
    mocks.auth = { status: "unavailable", httpStatus: 503, detail: "transmissão não configurada." };

    renderRoom();

    const button = screen.getByRole("button", { name: /transmissão não configurada/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("transmissão não configurada neste deploy")).toBeTruthy();
  });

  it("sem permissão na sala (403), o motivo não é o mesmo do 503", () => {
    mocks.auth = { status: "unavailable", httpStatus: 403, detail: "não é membro desta sala." };

    renderRoom();

    expect(
      (screen.getByRole("button", { name: /não pode transmitir/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sessão expirada (401) tem motivo próprio", () => {
    mocks.auth = { status: "unavailable", httpStatus: 401, detail: "não autenticado." };

    renderRoom();

    expect(screen.getByText("sessão expirada — recarregue a sala")).toBeTruthy();
  });

  it("token em voo: desabilitado, mas sem chamar isso de erro", () => {
    mocks.auth = { status: "pending" };

    renderRoom();

    expect(
      (screen.getByRole("button", { name: /conectando ao servidor/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("credencial em mãos mas WebSocket fora: desabilitado por conexão", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "disconnected";

    renderRoom();

    expect(
      (screen.getByRole("button", { name: /sem conexão com o servidor/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  // Colapsar `connecting` em "sem conexão" diz que algo quebrou quando o
  // WebSocket pode estar apenas subindo — e a sala fazia isso.
  it("conectando não se apresenta como falta de conexão", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "connecting";

    renderRoom();

    expect(screen.getByText("conectando ao servidor de transmissão")).toBeTruthy();
    expect(screen.queryByText("sem conexão com o servidor de transmissão")).toBeNull();
  });

  it("reconectando tem motivo distinto de sem conexão", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "reconnecting";

    renderRoom();

    expect(
      (screen.getByRole("button", { name: /reconectando ao servidor/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  // O ponto do gate: pedir captura com o SFU fora é o que produz a tela do
  // usuário compartilhada com ninguém recebendo. O clique tem de ser um no-op
  // ANTES do `getDisplayMedia`, não uma tentativa que falha depois.
  it("com o SFU indisponível, clicar não pede captura nenhuma", async () => {
    mocks.auth = { status: "unavailable", httpStatus: 503, detail: "transmissão não configurada." };

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: /transmissão não configurada/ }));

    expect(mocks.setScreenShareEnabled).not.toHaveBeenCalled();
    expect(mocks.writes).toHaveLength(0);
  });
});

describe("falha depois da captura concedida", () => {
  it("publicação falhou: desliga a captura e aponta o SFU, não o usuário", async () => {
    vi.stubGlobal("open", vi.fn());
    const falha = new Error("room is closed");
    falha.name = "InvalidStateError";
    mocks.setScreenShareEnabled.mockRejectedValueOnce(falha);

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));

    expect(await screen.findByText(/não conseguiu publicar/i)).toBeTruthy();
    // A distinction que faltava: cancelamento é do usuário, esta falha é nossa.
    expect(screen.queryByText(/cancelada ou negada/)).toBeNull();
    expect(mocks.writes).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  // O pior estado possível: o SO continua enviando a tela, ninguém recebe, e o
  // app diz que o usuário cancelou. A limpeza é o que fecha isso.
  it("desliga a captura que o SO já tinha concedido", async () => {
    vi.stubGlobal("open", vi.fn());
    const falha = new Error("publish failed");
    falha.name = "InvalidStateError";
    mocks.setScreenShareEnabled.mockRejectedValueOnce(falha);

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));

    await waitFor(() => {
      expect(mocks.setScreenShareEnabled).toHaveBeenCalledWith(false);
    });
    vi.unstubAllGlobals();
  });

  // Cancelamento é decisão do usuário e nada foi capturado, então não há o que
  // desligar — e dizer que desligamos seria mentira sobre o estado do SO.
  it("cancelamento no seletor não tenta desligar captura", async () => {
    vi.stubGlobal("open", vi.fn());
    mocks.setScreenShareEnabled.mockRejectedValueOnce(negado());

    renderRoom();
    fireEvent.click(screen.getByRole("button", { name: "iniciar transmissão de tela" }));

    expect(await screen.findByText("a captura de tela foi cancelada ou negada.")).toBeTruthy();
    expect(mocks.setScreenShareEnabled).not.toHaveBeenCalledWith(false);
    vi.unstubAllGlobals();
  });
});

// O motivo da falha de conexão é a única informação que separa "chave de outro
// projeto" de "URL errada" de "projeto fora do ar", e nenhuma delas é adivinhável
// pelo sintoma que a tela mostrava: "sem conexão".
describe("motivo da falha de conexão na tela", () => {
  it("401 no handshake aponta que URL e chaves devem ser do mesmo projeto", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "disconnected";
    mocks.failure = { httpStatus: 401, reason: "NotAllowed", detail: "connection closed" };

    renderRoom();

    expect(screen.getByText(/mesmo projeto/i)).toBeTruthy();
    // O status é fato e a dica é hipótese: os dois aparecem, mas separados.
    expect(screen.getByText(/status 401/)).toBeTruthy();
  });

  it("servidor inalcançável aponta o LIVEKIT_URL", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "disconnected";
    mocks.failure = { httpStatus: null, reason: "ServerUnreachable", detail: "no route to host" };

    renderRoom();

    expect(screen.getByText(/LIVEKIT_URL/)).toBeTruthy();
  });

  // O detalhe do servidor é o texto mais específico que existe — às vezes é ele
  // que diz "token does not match this project" em vez de 401 genérico.
  it("inclui o detalhe que o servidor mandou", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "disconnected";
    mocks.failure = {
      httpStatus: 401,
      reason: "NotAllowed",
      detail: "token does not match this project",
    };

    renderRoom();

    expect(screen.getByText(/token does not match this project/)).toBeTruthy();
  });

  // Uma falha antiga na tela com a transmissão funcionando é pior que a
  // ausência de mensagem: ela descreve um problema que não existe mais.
  it("conectado, o motivo desaparece mesmo que a falha tenha sido capturada", () => {
    mocks.auth = { status: "ready" };
    mocks.connection = "connected";
    mocks.failure = { httpStatus: 401, reason: "NotAllowed", detail: "connection closed" };

    renderRoom();

    expect(screen.queryByText(/mesmo projeto/i)).toBeNull();
    expect(screen.queryByText(/connection closed/)).toBeNull();
  });
});

// O host já ouve o som da aba compartilhada, direto e sem latência. Se a sala
// tocasse a track devolvida pelo SFU, ele ouviria o mesmo áudio duas vezes — uma
// na hora, outra com 1-2s de atraso. Não é eco, são duas fontes do mesmo som em
// tempos diferentes, e o ouvido lê como chiado de fase.
describe("o host não ouve a própria transmissão", () => {
  function montarComo(souHost: boolean) {
    mocks.root.broadcast = broadcast;
    const anexados: string[] = [];
    const video = screenShareRef(
      "outro",
      Track.Source.ScreenShare,
      fakeTrack((el) => anexados.push(el.tagName)),
    );
    const audio = screenShareRef(
      "outro",
      Track.Source.ScreenShareAudio,
      fakeTrack((el) => anexados.push(el.tagName)),
      souHost,
    );
    mocks.useTracksReturn = [video, audio];
    renderRoom();
    return anexados;
  }

  // O comportamento pedido: nada de áudio para o host.
  it("não anexa a track de áudio quando ela é a dele", () => {
    const anexados = montarComo(true);

    expect(anexados).toEqual(["VIDEO"]);
    expect(document.querySelector("audio")?.hasAttribute("srcObject")).toBe(false);
  });

  it("espectador continua ouvindo normalmente", () => {
    const anexados = montarComo(false);

    expect(anexados).toEqual(["VIDEO", "AUDIO"]);
  });

  // O áudio EXISTE e está sendo transmitido — só não toca para ele. Mostrar
  // "sem áudio" seria afirmar uma falha que não houve.
  it("não mostra aviso de áudio ausente para o host", () => {
    montarComo(true);

    expect(screen.queryByText(/sem áudio/i)).toBeNull();
  });

  it("espectador vê o aviso quando o Firefox não captura áudio", () => {
    mocks.root.broadcast = broadcast;
    mocks.useTracksReturn = [
      screenShareRef("outro", Track.Source.ScreenShare, fakeTrack(() => {})),
    ];

    renderRoom();

    expect(screen.getByText(/sem áudio/i)).toBeTruthy();
  });
});

// ── isolamento do estado do chat (FR-002, docs/specs/13-chat-sala/spec.md) ─────
//
// A medição original (docs/specs/13-chat-sala/research.md, seção 2) era: 1
// mensagem recebida re-renderiza a presença, que é o componente "fora do log"
// mais próximo. Este bloco é a regressão que impede a volta: o `Chat` real monta
// dentro da sala e a presença é um contador.

describe("isolamento do estado do chat", () => {
  // A store do feed é a porta de entrada: é por ela que uma "mensagem remota"
  // chega sem passar pelo socket, que não existe em jsdom.
  beforeEach(() => {
    resetChatFeed();
  });

  it("não re-renderiza nada fora do log quando chega mensagem (AC-001)", () => {
    renderRoom();
    for (let i = 1; i <= 30; i++) {
      act(() => appendChatItem({ type: "CHAT_MESSAGE", id: `c${i}`, authorId: "bruno", authorName: "bruno", text: `msg ${i}`, ts: Date.now() }));
    }
    const antes = mocks.presenceRenders.n;
    expect(screen.getByRole("log").querySelectorAll("li").length).toBeGreaterThan(0);

    act(() =>
      appendChatItem({ type: "CHAT_MESSAGE", id: "nova", authorId: "bruno", authorName: "bruno", text: "chegou agora", ts: Date.now() }),
    );

    expect(mocks.presenceRenders.n).toBe(antes);
    expect(screen.getByText("chegou agora")).toBeTruthy();
  });

  it("não re-renderiza nada fora do log quando o campo de mensagem muda (AC-003)", () => {
    renderRoom();
    const antes = mocks.presenceRenders.n;

    const campo = screen.getByLabelText("mensagem para o chat da sala");
    act(() => {
      fireEvent.change(campo, { target: { value: "d" } });
      fireEvent.change(campo, { target: { value: "da" } });
    });

    expect(mocks.presenceRenders.n).toBe(antes);
    expect((campo as HTMLTextAreaElement).value).toBe("da");
  });
});
