"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LiveKitRoom } from "@livekit/components-react";
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
  // `describeConnectError` nunca lança, então mesmo um erro inesperado aqui vira
  // uma falha legível em vez de derrubar a sala.
  const reportFailure = useCallback((error: unknown) => {
    setFailure(describeConnectError(error));
  }, []);

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
          // `connect` fica LIGADO de propósito, e quem conecta é o próprio
          // `LiveKitRoom`.
          //
          // A versão anterior desta linha punha `connect={false}` e conectava de
          // dentro, num `ConnectGate`. Isso não funciona: o efeito do Livekit tem
          // um `else` que chama `room.disconnect()` quando `connect` é falso, e
          // efeito de pai roda DEPOIS do do filho. A ordem real era o `ConnectGate`
          // chamar `connect()` e o Livekit desconectar em seguida — a promessa
          // pendente era rejeitada com `Cancelled: Client initiated disconnect`, e
          // a transmissão não subia nunca. Era a causa do sintoma, não do
          // diagnóstico.
          //
          // `onError` é a prop que traz o motivo — um `ConnectionError` com
          // `.status` (o HTTP do handshake) e `.reasonName`. Ela existe desde
          // sempre: a ausência anterior foi um grep meu no bundle errado, não uma
          // limitação da biblioteca.
          onError={reportFailure}
          // Conectar limpa a falha anterior: o handshake é assíncrono e o erro de
          // uma tentativa velha ficaria na tela com a transmissão já funcionando.
          onConnected={clearFailure}
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
          {children}
        </LiveKitRoom>
      </LiveKitFailureContext.Provider>
    </LiveKitAuthContext.Provider>
  );
}
