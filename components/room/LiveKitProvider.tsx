"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LiveKitRoom, useMaybeRoomContext } from "@livekit/components-react";
import { describeConnectError, type SfuFailure } from "@/lib/sfu-connect";

// Estado da credencial e da conexão com o SFU, para a sala poder ser honesta
// sobre a transmissão.
//
// Por que isto existe: o `LiveKitRoom` aceita `token={undefined}` e espera em
// silêncio, e não aceita `onError`. Sem esta informação, uma credencial que
// nunca chega — 503 de env var faltando, 403 de membership, 401 de sessão, rede
// fora — produz uma sala que parece pronta e um botão de transmitir que falha no
// clique, com uma mensagem dizendo que o usuário cancelou. Foi exatamente o que
// aconteceu na primeira tentativa em produção.
//
// A distinção que importa: **o erro de credencial é do deploy e o erro de
// captura é do usuário**, e a UI precisa saber qual é para não atribuir ao
// usuário um problema de configuração.

export type LiveKitAuth =
  /** Sem `LIVEKIT_URL`: a feature não existe neste deploy. */
  | { status: "disabled" }
  /** Token em voo. Ainda não se sabe se vai dar certo. */
  | { status: "pending" }
  /** Credencial em mãos. A conexão WebSocket ainda é uma questão separada. */
  | { status: "ready" }
  /**
   * A credencial não veio. `httpStatus` é o que torna isso diagnosticável sem
   * abrir o DevTools: 503 é env var faltando, 403 é membership, 401 é sessão,
   * `null` é rede ou rota fora do ar.
   */
  | { status: "unavailable"; httpStatus: number | null; detail: string };

const LiveKitAuthContext = createContext<LiveKitAuth>({ status: "disabled" });

/** Motivo da falha de conexão, ou `null` enquanto não houve falha. */
const LiveKitFailureContext = createContext<SfuFailure | null>(null);

export function useLiveKitAuth(): LiveKitAuth {
  return useContext(LiveKitAuthContext);
}

export function useLiveKitFailure(): SfuFailure | null {
  return useContext(LiveKitFailureContext);
}

export function LiveKitProvider({
  serverUrl,
  roomCode,
  children,
}: {
  serverUrl: string | null;
  roomCode: string;
  children: ReactNode;
}) {
  // `pending` é o estado inicial de propósito: o `LiveKitRoom` só sobe quando há
  // `serverUrl`, e nesse caminho a credencial está sempre em voo no primeiro
  // render. `disabled` é o valor do contexto padrão, para o caso sem Livekit —
  // que nem chega a renderizar estes hooks, porque o provider retorna os filhos
  // sem o contexto.
  const [token, setToken] = useState<string | undefined>(undefined);
  const [auth, setAuth] = useState<LiveKitAuth>({ status: "pending" });
  const [failure, setFailure] = useState<SfuFailure | null>(null);
  // `setState` de `useState` é estável, mas envolvê-lo mantém a assinatura de
  // `ConnectGate` explícita e o efeito abaixo livre da regra de dependências.
  const clearFailure = useCallback(() => setFailure(null), []);

  useEffect(() => {
    if (!serverUrl) return;
    let cancelled = false;

    type Result = { token: string | undefined; auth: LiveKitAuth };

    fetch("/api/livekit-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: roomCode }),
    })
      .then(async (response): Promise<Result> => {
        if (response.ok) {
          return { token: await response.text(), auth: { status: "ready" } };
        }
        // O corpo da rota é texto nosso, em pt-BR, e cada status tem uma causa
        // diferente. Propagar o status e o texto é o que permite dizer na UI o
        // que aconteceu em vez de um "não funcionou" genérico.
        const detail = await response.text().catch(() => "");
        return {
          token: undefined,
          auth: { status: "unavailable", httpStatus: response.status, detail },
        };
      })
      .catch((): Result => {
        // `TypeError: Failed to fetch` é o formato do browser para rede fora,
        // CORS ou rota ausente. Não há status para mostrar, e a sala segue no
        // modo player com o Liveblocks de pé, que é quem carrega storage e chat.
        return {
          token: undefined,
          auth: {
            status: "unavailable",
            httpStatus: null,
            detail: "não foi possível contatar o servidor de transmissão.",
          },
        };
      })
      .then((result) => {
        if (cancelled) return;
        setToken(result.token);
        setAuth(result.auth);
      });

    return () => {
      cancelled = true;
    };
  }, [serverUrl, roomCode]);

  if (!serverUrl) return <>{children}</>;

  return (
    <LiveKitAuthContext.Provider value={auth}>
      <LiveKitFailureContext.Provider value={failure}>
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          // `connect={false}` e a conexão é feita por `<ConnectGate>` abaixo.
          // O componente só sabe o motivo da falha se a promise do `connect` for
          // capturada por quem chamou, e quem chama é o `LiveKitRoom` — que não
          // expõe `onError`. Sem este `false`, o motivo da falha mais
          // diagnosticável do produto (401 por chave de outro projeto) seria
          // impossível de ver.
          connect={false}
          // Nada é publicado ao entrar: o único áudio e o único vídeo do app são os
          // que o host capturar (FR-015). Nenhuma permissão de microfone é pedida,
          // e a captura de tela só acontece no clique do botão.
          audio={false}
          video={false}
          screen={false}
          // `display: contents` dissolve o div que o `LiveKitRoom` renderiza
          // ao redor: a casca da sala (`h-dvh` + flex) continua sendo a raiz do
          // layout. Sem isso, o `div` do Livekit viraria a caixa externa e a altura
          // da sala passaria a depender do conteúdo dele.
          style={{ display: "contents" }}
        >
          <ConnectGate
            serverUrl={serverUrl}
            token={token}
            onSettled={setFailure}
            onConnected={clearFailure}
          >
            {children}
          </ConnectGate>
        </LiveKitRoom>
      </LiveKitFailureContext.Provider>
    </LiveKitAuthContext.Provider>
  );
}

/**
 * Conecta a room e reporta a falha.
 *
 * Fica DENTRO do `LiveKitRoom` porque o objeto `Room` só existe ali — o contexto
 * é criado pelo componente. Renderiza `children` sem 不 fazer nada: a
 * conexão é efeito, não markup.
 */
function ConnectGate({
  serverUrl,
  token,
  onSettled,
  onConnected,
  children,
}: {
  serverUrl: string;
  token: string | undefined;
  onSettled: (failure: SfuFailure) => void;
  onConnected: () => void;
  children: ReactNode;
}) {
  const room = useMaybeRoomContext();

  useEffect(() => {
    // Sem token não há o que assinar. O `LiveKitRoom` esperaria em silêncio; o
    // botão de transmitir é que falharia no clique, sem motivo.
    if (!room || !token) return;
    let cancelled = false;

    room
      .connect(serverUrl, token)
      .then(() => {
        if (cancelled) return;
        // Uma falha antiga não pode sobreviver a uma conexão boa: o log do
        // handshake é assíncrono e o erro da primeira tentativa continuaria na
        // tela com a transmissão já funcionando.
        onConnected();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onSettled(describeConnectError(error));
      });

    return () => {
      cancelled = true;
    };
  }, [room, serverUrl, token, onSettled, onConnected]);

  return <>{children}</>;
}
