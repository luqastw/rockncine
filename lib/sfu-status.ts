import { ConnectionState } from "livekit-client";
import type { LiveKitAuth } from "@/components/room/LiveKitProvider";
import { sfuFailureHint, type SfuFailure } from "@/lib/sfu-connect";

export function sfuBlockedReason(auth: LiveKitAuth, connection: ConnectionState): string | null {
  if (auth.status === "unavailable") {
    if (auth.httpStatus === 503) return "Transmissão não configurada neste deploy";
    if (auth.httpStatus === 403) return "Você não pode transmitir nesta sala";
    if (auth.httpStatus === 401) return "Sessão expirada — recarregue a sala";
    return "Servidor de transmissão indisponível";
  }
  if (auth.status !== "ready") return "Conectando ao servidor de transmissão";
  if (connection === ConnectionState.Connecting) return "Conectando ao servidor de transmissão";
  if (connection === ConnectionState.Reconnecting) return "Reconectando ao servidor de transmissão";
  if (connection !== ConnectionState.Connected) return "Sem conexão com o servidor de transmissão";
  return null;
}

export function sfuLivekitReason(failure: SfuFailure | null, connected: boolean): string | null {
  if (!failure || connected) return null;
  const status = failure.httpStatus === null ? [] : [`status ${failure.httpStatus}`];
  return [...status, sfuFailureHint(failure), failure.detail].filter(Boolean).join(" · ");
}
