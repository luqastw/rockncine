import { describe, expect, it } from "vitest";
import { ConnectionError } from "livekit-client";
import { describeConnectError, sfuFailureHint } from "./sfu-connect";

// A tradução do erro de conexão é a única forma de o motivo aparecer na sala:
// `ConnectionStateChanged` não traz motivo, e `LiveKitRoom` não tem `onError`.
// O que ela precisa acertar é o status HTTP, porque é ele que separa "chave de
// outro projeto" (401) de "URL errada" (404) de "projeto caiu" (sem status).

describe("describeConnectError", () => {
  // É o caso quepdevolveu a falha real: `/rtc` respondendo 401 porque o token foi
  // assinado com as chaves de um projeto e o handshake chega em outro.
  it("401 vira status 401 e NotAllowed", () => {
    const error = ConnectionError.notAllowed("connection closed", 401);

    expect(describeConnectError(error)).toMatchObject({
      httpStatus: 401,
      reason: "NotAllowed",
    });
  });

  it("colapsa whitespace do detalhe, para caber numa linha", () => {
    const error = ConnectionError.notAllowed("token  does not\n  match this project", 401);

    expect(describeConnectError(error).detail).toBe("token does not match this project");
  });

  it("normaliza whitespace e corta texto gigante", () => {
    const error = ConnectionError.internal("a\n\n  b   c".repeat(60), { status: 500 });

    const { detail } = describeConnectError(error);
    expect(detail).not.toContain("\n");
    expect(detail.length).toBeLessThanOrEqual(180);
    expect(detail.endsWith("...")).toBe(true);
  });

  // `TypeError: Failed to fetch` é o formato do browser para rede fora, DNS ou
  // CORS. Não há status, e inventar um seria mentir sobre o que se sabe.
  it("erro comum do browser vira sem status", () => {
    const error = new TypeError("Failed to fetch");

    expect(describeConnectError(error)).toMatchObject({
      httpStatus: null,
      reason: null,
      detail: "Failed to fetch",
    });
  });

  // Um diagnóstico que lança ao ser chamado é pior que ausência de diagnóstico:
  // ele derrubaria a sala que deveria explicar.
  it("nunca lança, qualquer que seja a entrada", () => {
    for (const entrada of [null, undefined, "texto", 42, {}, []]) {
      expect(() => describeConnectError(entrada)).not.toThrow();
      expect(describeConnectError(entrada).detail).toBeTypeOf("string");
    }
  });
});

describe("sfuFailureHint", () => {
  // O caso real que veio da produção: o servidor respondeu recusando o token, mas
  // o Livekit classificou como `ServerUnreachable` porque a conexão de sinal não
  // subiu. A dica por reason dizia "confira o LIVEKIT_URL" — a instrução errada.
  // O `detail` é mais específico que o enum, e é quem tem precedência.
  it('"invalid token" aponta as chaves, mesmo com reason de servidor fora', () => {
    const hint = sfuFailureHint({
      httpStatus: null,
      reason: "ServerUnreachable",
      detail: "could not establish signal connection: invalid token",
    });

    expect(hint).toContain("API_KEY");
    expect(hint).toContain("API_SECRET");
    expect(hint).not.toContain("confira o LIVEKIT_URL");
  });

  it("token expirado é o mesmo problema de credencial", () => {
    const hint = sfuFailureHint({
      httpStatus: null,
      reason: "ServerUnreachable",
      detail: "token is expired",
    });

    expect(hint).toContain("API_KEY");
  });

  it("401 com detail genérico ainda aponta as chaves", () => {
    expect(sfuFailureHint({ httpStatus: 401, reason: "NotAllowed", detail: "" })).toContain(
      "API_SECRET",
    );
  });

  // Um detail que NÃO é de credencial tem de continuar caindo no caminho do
  // reason, senão a precedência do detail viraria "qualquer texto vence".
  it("detail sem menção a credencial não sequestra o reason", () => {
    const hint = sfuFailureHint({
      httpStatus: null,
      reason: "ServerUnreachable",
      detail: "no route to host",
    });

    expect(hint).toContain("LIVEKIT_URL");
  });


  // A mensagem precisa apontar a AÇÃO, não o sintoma. "sem conexão" não dizia o
  // que fazer; esta diz exatamente qual par de variáveis conferir.
  it("401 aponta a causa provável: URL e chaves de projetos diferentes", () => {
    const hint = sfuFailureHint({
      httpStatus: 401,
      reason: "NotAllowed",
      detail: "connection closed",
    });

    expect(hint).toContain("mesmo projeto");
    expect(hint).toContain("API_SECRET");
  });

  it("403 é falta de permissão, não credencial errada", () => {
    const hint = sfuFailureHint({ httpStatus: 403, reason: "NotAllowed", detail: "" });

    expect(hint).toContain("403");
    expect(hint).not.toContain("mesmo projeto");
  });

  it("servidor inalcançável aponta o LIVEKIT_URL", () => {
    const hint = sfuFailureHint({ httpStatus: null, reason: "ServerUnreachable", detail: "" });

    expect(hint).toContain("LIVEKIT_URL");
  });

  it("sem status e sem reason cai no genérico honesto", () => {
    expect(sfuFailureHint({ httpStatus: null, reason: null, detail: "" })).toMatch(/não foi possível/);
  });

  it("status sem reason conhecido cai no status", () => {
    expect(sfuFailureHint({ httpStatus: 404, reason: null, detail: "" })).toContain("404");
  });
});
