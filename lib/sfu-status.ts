import { ConnectionState } from "livekit-client";
import type { LiveKitAuth } from "@/components/room/LiveKitProvider";
import { sfuFailureHint, type SfuFailure } from "@/lib/sfu-connect";

export function sfuBlockedReason(auth: LiveKitAuth, connection: ConnectionState): string | null {
  if (auth.status === "unavailable") {
    if (auth.httpStatus === 503) return "transmissão não configurada neste deploy";
    if (auth.httpStatus === 403) return "você não pode transmitir nesta sala";
    if (auth.httpStatus === 401) return "sessão expirada — recarregue a sala";
    return "servidor de transmissão indisponível";
  }
  if (auth.status !== "ready") return "conectando ao servidor de transmissão";
  if (connection === ConnectionState.Connecting) return "conectando ao servidor de transmissão";
  if (connection === ConnectionState.Reconnecting) return "reconectando ao servidor de transmissão";
  if (connection !== ConnectionState.Connected) return "sem conexão com o servidor de transmissão";
  return null;
}

export function sfuLivekitReason(failure: SfuFailure | null, connected: boolean): string | null {
  if (!failure || connected) return null;
  const status = failure.httpStatus === null ? [] : [`status ${failure.httpStatus}`];
  return [...status, sfuFailureHint(failure), failure.detail].filter(Boolean).join(" · ");
}
