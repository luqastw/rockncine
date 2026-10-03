import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O que este teste cobre: a degradação e a ordem. Sem `serverUrl` a árvore da
// sala renderiza direto (modo player, sem SFU); com `serverUrl`, o token é
// pedido e entregue ao `LiveKitRoom`, e o `LiveKitRoom` fica ENVOLVENDO a sala
// desde o primeiro render — não só quando há transmissão.
//
// O que ele NÃO cobre: a conexão WebRTC, a negociação de codec e a track
// chegando. `LiveKitRoom` e `livekit-client` não rodam em jsdom.

const mocks = vi.hoisted(() => ({
  liveKitRoomProps: [] as Record<string, unknown>[],
  children: [] as unknown[],
  fetch: vi.fn(),
}));

vi.mock("@livekit/components-react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@livekit/components-react");
  return {
    ...actual,
    LiveKitRoom: ({
      children,
      ...props
    }: {
      children?: unknown;
      [key: string]: unknown;
    }) => {
      mocks.liveKitRoomProps.push(props);
      mocks.children.push(children);
      return <div data-testid="livekit-room">{children as never}</div>;
    },
  };
});

import { ConnectionError } from "livekit-client";
import { sfuFailureHint } from "@/lib/sfu-connect";
import { LiveKitProvider, useLiveKitFailure } from "./LiveKitProvider";

const ROOM = "SALA1234";
const URL_LK = "wss://projeto.livekit.cloud";

function okResponse(body: string) {
  return { ok: true, status: 200, text: () => Promise.resolve(body) } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  // `liveKitRoomProps` e `children` são arrays comuns, não mocks — `clearAllMocks`
  // não os limpa. Sem esta linha, o teste N lê as props do render do teste N-1, de
  // um componente já desmontado: o `onError` capturado chama `setState` de um
  // componente morto, que é no-op, e o motivo nunca aparece na tela. A falha se
  // apresenta como "o contexto não propaga", que não é onde está a causa.
  mocks.liveKitRoomProps.length = 0;
  mocks.children.length = 0;
  mocks.fetch.mockResolvedValue(okResponse("token.jwt.valido"));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveKitProvider", () => {
  it("sem serverUrl a sala renderiza direto, sem wrapper de SFU", () => {
    render(
      <LiveKitProvider serverUrl={null} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(screen.getByText("a sala")).toBeTruthy();
    expect(screen.queryByTestId("livekit-room")).toBeNull();
    // Nenhum pedido de token: sem endpoint configurado não há para onde pedir.
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  // A sala é envolvida SEMPRE, não só quando há transmissão: abrir sob demanda
  // custaria uma rodada extra de token + negotiate antes de qualquer preview.
  it("com serverUrl, o LiveKitRoom envolve a sala já no primeiro render", () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(screen.getByTestId("livekit-room")).toBeTruthy();
    expect(screen.getByText("a sala")).toBeTruthy();
    // O token ainda não chegou no primeiro render — e o wrapper já existe.
    expect(mocks.liveKitRoomProps[0]).toMatchObject({ token: undefined, serverUrl: URL_LK });
  });

  // `display: contents` dissolve o div do Livekit no layout: sem ele, essa caixa
  // viraria a raiz do flex da sala e a altura passaria a depender do conteúdo
  // dela em vez do `h-dvh` do `<main>`.
  it("o div do Livekit não participa do layout", () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(mocks.liveKitRoomProps[0].style).toEqual({ display: "contents" });
  });

  it("pede o token da sala e o entrega ao LiveKitRoom", async () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    await waitFor(() => {
      expect(mocks.liveKitRoomProps.at(-1)).toMatchObject({ token: "token.jwt.valido" });
    });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/livekit-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: ROOM }),
    });
  });

  // Nada de áudio nem vídeo publicados ao entrar: o único som do app é o que o
  // host capturar, e nenhuma permissão de microfone é pedida.
  it("não pede áudio, câmera nem tela na montagem", () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(mocks.liveKitRoomProps[0]).toMatchObject({
      audio: false,
      video: false,
      screen: false,
    });
    // `connect` NÃO pode ser `false`: o efeito do Livekit chama
    // `room.disconnect()` nesse caso, e qualquer conexão iniciada de dentro morre
    // com "Client initiated disconnect". Quem conecta é o próprio `LiveKitRoom`,
    // e o motivo chega pelo `onError`.
    expect(mocks.liveKitRoomProps[0].connect).not.toBe(false);
  });

  // Livekit fora do ar não pode derrubar a sala: a conexão do Liveblocks, que
  // carrega o storage e o chat, é independente.
  it("token não vem: a sala continua montada, sem erro", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve("") } as unknown as Response);

    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(screen.getByText("a sala")).toBeTruthy();
    expect(mocks.liveKitRoomProps.at(-1)).toMatchObject({ token: undefined });
  });

  it("fetch rejeita: a sala continua montada, sem erro", async () => {
    mocks.fetch.mockRejectedValue(new Error("rede"));

    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalled());
    expect(screen.getByText("a sala")).toBeTruthy();
  });
});

describe("motivo da falha de conexão", () => {
  // Quem chama `room.connect()` é o `LiveKitRoom`, e o motivo chega por `onError`.
  // Sem estas duas props o botão de transmitir falha no clique sem dizer nada.
  it("liga o onError e o onConnected no LiveKitRoom", () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(mocks.liveKitRoomProps[0].onError).toBeTypeOf("function");
    expect(mocks.liveKitRoomProps[0].onConnected).toBeTypeOf("function");
  });

  it("um erro do Livekit vira motivo legível para a sala", async () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <FalhaVisivel />
      </LiveKitProvider>,
    );

    const onError = mocks.liveKitRoomProps[0].onError as (e: unknown) => void;
    await act(async () => {
      onError(ConnectionError.notAllowed("connection closed", 401));
    });

    // O texto é montado de hint + status num único parágrafo, então o
    // casamento é por conteúdo, não por elemento.
    const falha = screen.getByTestId("falha");
    expect(falha.textContent).toContain("401");
    expect(falha.textContent).toContain("mesmo projeto");
  });

  // Uma falha antiga não pode sobreviver a uma conexão boa: descreveria um
  // problema que não existe mais, com a transmissão já funcionando.
  it("conectar limpa o motivo anterior", async () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <FalhaVisivel />
      </LiveKitProvider>,
    );

    const props = mocks.liveKitRoomProps[0];
    await act(async () => {
      (props.onError as (e: unknown) => void)(ConnectionError.serverUnreachable("no route"));
    });
    expect(screen.getByTestId("falha").textContent).toContain("LIVEKIT_URL");

    await act(async () => {
      (props.onConnected as () => void)();
    });

    expect(screen.getByTestId("falha").textContent).toBe("sem falha");
  });
});

// Consumidor mínimo do contexto: é o que a sala usa para mostrar o motivo.
function FalhaVisivel() {
  const failure = useLiveKitFailure();
  if (!failure) return <p data-testid="falha">sem falha</p>;
  return (
    <p data-testid="falha">
      {sfuFailureHint(failure)}
      {failure.httpStatus ? ` ${failure.httpStatus}` : ""}
    </p>
  );
}
