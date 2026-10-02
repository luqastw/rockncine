// Configuração do SFU (FR-020, docs/specs/12-transmissao-screen-share/spec.md).
//
// Só o servidor enxerga `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`, e é por isso que
// a checagem de "está configurado?" mora aqui e não no componente: o cliente
// recebe `serverUrl` por prop, vindo da página da sala, e nunca a chave.
//
// A degradação é o comportamento padrão, não o de exceção: sem
// `LIVEKIT_URL` a sala continua no modo player e o botão de transmitir não
// existe. Um projeto novo que não configure o Livekit não pode ter a sala
// quebrada por isso.

// O token é de uso curto e é consumido logo na montagem do `LiveKitRoom`: cada
// sala pede o seu, e a conexão fica de pé depois sem revalidar nada.
export const LIVEKIT_TOKEN_TTL = "2h";

/** `wss://<projeto>.livekit.cloud` do LiveKit Cloud, ou `null` se ausente. */
export function livekitServerUrl(): string | null {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) return null;
  return url;
}

/** Chave e segredo presentes no servidor — sem eles não há token (FR-020). */
export function livekitCredentials(): { apiKey: string; apiSecret: string } | null {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}
