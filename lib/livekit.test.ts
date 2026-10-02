// @vitest-environment node
// Ambiente `node`: estas funções leem `process.env` e não tocam em DOM, e o
// `node` evita carregar o jsdom inteiro para ler três variáveis.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { livekitCredentials, livekitServerUrl } from "./livekit";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("livekitServerUrl", () => {
  // A degradação é o comportamento padrão: um deploy novo, sem projeto no
  // Livekit Cloud, tem que ter a sala funcionando no modo player.
  it("ausente devolve null em vez de string vazia", () => {
    expect(livekitServerUrl()).toBeNull();
  });

  it("devolve a URL como está", () => {
    process.env.LIVEKIT_URL = "wss://projeto.livekit.cloud";
    expect(livekitServerUrl()).toBe("wss://projeto.livekit.cloud");
  });

  // `.env.example` traz as três com `""`; sem o trim, `""` passaria pela
  // checagem de truthiness do JSX e o `LiveKitRoom` receberia uma string vazia
  // como `serverUrl`.
  it("string vazia e só espaços contam como ausente", () => {
    process.env.LIVEKIT_URL = "";
    expect(livekitServerUrl()).toBeNull();

    process.env.LIVEKIT_URL = "   ";
    expect(livekitServerUrl()).toBeNull();
  });

  // A URL é repassada como está para o SDK: normalizar aqui (barra final,
  // `https://` em vez de `wss://`) seria uma transformação silenciosa de
  // configuração, e o valor vem do painel do projeto.
  it("não normaliza a URL", () => {
    process.env.LIVEKIT_URL = "https://projeto.livekit.cloud/";
    expect(livekitServerUrl()).toBe("https://projeto.livekit.cloud/");
  });
});

describe("livekitCredentials", () => {
  it("sem chave ou sem segredo devolve null", () => {
    expect(livekitCredentials()).toBeNull();

    process.env.LIVEKIT_API_KEY = "APIkey";
    expect(livekitCredentials()).toBeNull();

    delete process.env.LIVEKIT_API_KEY;
    process.env.LIVEKIT_API_SECRET = "segredo";
    expect(livekitCredentials()).toBeNull();
  });

  it("com as duas, devolve o par", () => {
    process.env.LIVEKIT_API_KEY = "APIkey";
    process.env.LIVEKIT_API_SECRET = "segredo";

    expect(livekitCredentials()).toEqual({ apiKey: "APIkey", apiSecret: "segredo" });
  });

  it("espaço em volta é aparado — a chave copiada do painel costuma vir assim", () => {
    process.env.LIVEKIT_API_KEY = "  APIkey\n";
    process.env.LIVEKIT_API_SECRET = "segredo ";

    expect(livekitCredentials()).toEqual({ apiKey: "APIkey", apiSecret: "segredo" });
  });
});
