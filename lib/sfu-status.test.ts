import { describe, expect, it } from "vitest";
import { ConnectionState } from "livekit-client";
import { sfuBlockedReason, sfuLivekitReason } from "./sfu-status";

describe("sfuBlockedReason", () => {
  it.each([
    [503, "transmissão não configurada neste deploy"],
    [403, "você não pode transmitir nesta sala"],
    [401, "sessão expirada — recarregue a sala"],
    [500, "servidor de transmissão indisponível"],
    [null, "servidor de transmissão indisponível"],
  ])("unavailable %s", (httpStatus, expected) => {
    const auth = { status: "unavailable" as const, httpStatus, detail: "" };
    expect(sfuBlockedReason(auth, ConnectionState.Connected)).toBe(expected);
  });

  it.each([{ status: "pending" as const }, { status: "disabled" as const }])(
    "credencial não pronta ($status)",
    (auth) => {
      expect(sfuBlockedReason(auth, ConnectionState.Connected)).toBe(
        "conectando ao servidor de transmissão",
      );
    },
  );

  it("distingue um estado de conexão por estado", () => {
    const auth = { status: "ready" as const };
    expect(sfuBlockedReason(auth, ConnectionState.Connecting)).toBe(
      "conectando ao servidor de transmissão",
    );
    expect(sfuBlockedReason(auth, ConnectionState.Reconnecting)).toBe(
      "reconectando ao servidor de transmissão",
    );
    expect(sfuBlockedReason(auth, ConnectionState.Disconnected)).toBe(
      "sem conexão com o servidor de transmissão",
    );
  });

  it("conectado e pronto não bloqueia", () => {
    expect(sfuBlockedReason({ status: "ready" }, ConnectionState.Connected)).toBeNull();
  });
});

describe("sfuLivekitReason", () => {
  it("sem falha ou conectado devolve null", () => {
    const failure = { httpStatus: 401, reason: "NotAllowed", detail: "x" };
    expect(sfuLivekitReason(null, false)).toBeNull();
    expect(sfuLivekitReason(failure, true)).toBeNull();
  });

  it("inclui o status como fato e o detalhe", () => {
    const reason = sfuLivekitReason({ httpStatus: 401, reason: "NotAllowed", detail: "token ruim" }, false);
    expect(reason).toContain("status 401");
    expect(reason).toContain("token ruim");
  });

  it("omite status quando o servidor não respondeu", () => {
    const reason = sfuLivekitReason({ httpStatus: null, reason: null, detail: "rede" }, false);
    expect(reason).not.toContain("status");
    expect(reason).toContain("rede");
  });
});
