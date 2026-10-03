"use client";

import { ConnectionError, ConnectionErrorReason } from "livekit-client";

// Falha de conexão com o SFU, traduzida para algo que a sala consegue mostrar.
//
// Por que este módulo existe: `RoomEvent.ConnectionStateChanged` emite **só** o
// estado, sem motivo. O `LiveKitRoom` não aceita `onError`. E o
// `setLogExtension` do `livekit-client`, que resolveria, **não é exportado** —
// existe no bundle mas é API privada, e depender de API privada para diagnóstico é
// como a feature nasce quebrada sem ninguém perceber.
//
// A via pública é conectar nós mesmos. `Room.connect()` rejeita com
// `ConnectionError`, que carrega `.status` (o HTTP status do handshake) e
// `.reasonName`. O status é a informação decisiva: um 401 no `/rtc` significa
// que a assinatura do token não bate com as chaves do projeto que answering —
// normalmente URL e chaves copiadas de projetos diferentes.

export type SfuFailure = {
  /** Status HTTP do handshake, quando o servidor respondeu. */
  httpStatus: number | null;
  /** `NotAllowed`, `ServerUnreachable`, `InternalError`… quando é um erro do Livekit. */
  reason: string | null;
  /** Texto do servidor, já normalizado para caber numa linha. */
  detail: string;
};

/**
 * Por que a conexão caiu, em pt-BR, com o que o usuário pode fazer.
 *
 * O `detail` do servidor tem precedência sobre o `reason` quando ele nomeia o
 * problema. O enum não distingue: um token inválido chega como
 * `ServerUnreachable` (a conexão de sinal não subiu), e a dica "confira o
 * LIVEKIT_URL" seria errada — o servidor respondeu, só recusou a credencial.
 * O texto do servidor é mais específico que a classificação, e é o único que
 * separa "chave de outro projeto" de "projeto fora do ar".
 */
export function sfuFailureHint(failure: SfuFailure): string {
  const { httpStatus, reason, detail } = failure;

  // 401 é sempre credencial recusada, com ou sem detail que confirme.
  if (httpStatus === 401) return KEYS;
  if (falaDeCredencial(detail)) return KEYS;

  if (reason === ConnectionErrorReason[ConnectionErrorReason.NotAllowed]) {
    if (httpStatus === 403) {
      return "sem permissão para entrar nesta room (403).";
    }
    return "o SFU recusou a credencial.";
  }

  if (reason === ConnectionErrorReason[ConnectionErrorReason.ServerUnreachable]) {
    return "o servidor de transmissão não respondeu. confira o LIVEKIT_URL.";
  }

  if (reason === ConnectionErrorReason[ConnectionErrorReason.InternalError]) {
    return "erro interno no servidor de transmissão.";
  }

  if (reason === ConnectionErrorReason[ConnectionErrorReason.Cancelled]) {
    return "a conexão foi cancelada antes de subir.";
  }

  if (httpStatus !== null) return `o SFU respondeu ${httpStatus}.`;
  return "não foi possível falar com o servidor de transmissão.";
}

// A causa mais provável de token recusado: a URL e as chaves vêm de páginas
// diferentes do painel. A rota de token responde 200 porque assinar com as chaves
// coladas sempre funciona — quem valida a assinatura é o projeto que atende o
// handshake, e ele não reconhece chaves alheias.
const KEYS =
  "token recusado: o LIVEKIT_API_KEY e o LIVEKIT_API_SECRET precisam ser do mesmo projeto do LIVEKIT_URL — copie o par da mesma página do projeto.";

// O servidor nomeia o problema no texto quando ele é de credencial. São as
// formas que o Livekit usa, mais as variações que aparecem em tradução.
const CREDENCIAL =
  /invalid token|token (is )?(invalid|expired|malformed|not valid)|verify\s*token|signature|jwt|unauthorized|forbidden|not allowed/i;

function falaDeCredencial(detail: string): boolean {
  return CREDENCIAL.test(detail);
}

const MAX_DETAIL = 180;

function normalizeDetail(message: unknown): string {
  if (typeof message !== "string") return "";
  const text = message.trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.length > MAX_DETAIL ? `${text.slice(0, MAX_DETAIL - 3)}...` : text;
}

/**
 * Converte o que `room.connect()` lançou na falha que a sala mostra. Nunca
 * lança: um diagnóstico que derruba a tela que ele deveria explicar é pior que
 * ausência de diagnóstico.
 */
export function describeConnectError(error: unknown): SfuFailure {
  if (error instanceof ConnectionError) {
    return {
      httpStatus: typeof error.status === "number" ? error.status : null,
      reason: error.reasonName ?? null,
      detail: normalizeDetail(error.message),
    };
  }
  // `TypeError: Failed to fetch` é o formato do browser para rede fora, CORS ou
  // DNS. Não há status nem reason, e a distinção entre eles não é possível
  // daqui — o texto do browser é a única informação.
  return { httpStatus: null, reason: null, detail: normalizeDetail(errorOf(error)) };
}

function errorOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
