import { render, screen, waitFor } from "@testing-library/react";
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
  // O `Room` que o `ConnectGate` obtém do contexto. `connect` é quem carrega o
  // motivo da falha, então precisa ser observável.
  connect: vi.fn(),
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
    useMaybeRoomContext: () => ({ connect: mocks.connect }),
  };
});

import { LiveKitProvider } from "./LiveKitProvider";

const ROOM = "SALA1234";
const URL_LK = "wss://projeto.livekit.cloud";

function okResponse(body: string) {
  return { ok: true, status: 200, text: () => Promise.resolve(body) } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue(okResponse("token.jwt.valido"));
  mocks.connect.mockResolvedValue(undefined);
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
      // `false` de propósito: quem conecta é o `ConnectGate`, porque só quem
      // chama `room.connect()` captura o motivo da falha.
      connect: false,
    });
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

describe("ConnectGate", () => {
  it("conecta com a url e o token assim que os dois existem", async () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith(URL_LK, "token.jwt.valido"));
  });

  // Sem token não há o que assinar, e tentar assim seria conectar com
  // `undefined` e falhar com um erro que não significa nada.
  it("não tenta conectar antes do token chegar", () => {
    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    expect(mocks.connect).not.toHaveBeenCalled();
  });

  // O motivo da falha é o que torna 401-por-chave-de-outro-projeto
  // diagnosticável. Uma rejeição tem de virar estado, não sumir.
  it("uma falha de conexão não derruba a sala", async () => {
    const falha = new Error("connection closed");
    mocks.connect.mockRejectedValue(falha);

    render(
      <LiveKitProvider serverUrl={URL_LK} roomCode={ROOM}>
        <p>a sala</p>
      </LiveKitProvider>,
    );

    await waitFor(() => expect(mocks.connect).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("a sala")).toBeTruthy());
  });
});
