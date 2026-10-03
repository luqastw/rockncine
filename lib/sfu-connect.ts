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

/** Por que a conexão caiu, em pt-BR, com o que o usuário pode fazer. */
export function sfuFailureHint(failure: SfuFailure): string {
  const { httpStatus, reason } = failure;

  if (reason === ConnectionErrorReason[ConnectionErrorReason.NotAllowed]) {
    if (httpStatus === 401) {
      return "credencial recusada (401). o LIVEKIT_URL e as chaves são do mesmo projeto?";
    }
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
