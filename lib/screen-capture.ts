// Opções repassadas literais ao getDisplayMedia pelo Livekit. selfBrowserSurface
// "exclude" evita o salão de espelhos (a sala transmitindo a si mesma);
// contentHint "motion" porque "detail" sacrifica taxa de quadros; displaySurface
// "browser" é só dica (aba é a captura mais barata e estável). A resolução e o
// encoding vêm de lib/broadcast-quality.ts, via terceiro argumento da publicação.
export const SCREEN_CAPTURE_OPTIONS = {
  audio: true,
  contentHint: "motion",
  video: { displaySurface: "browser" },
  selfBrowserSurface: "exclude",
  systemAudio: "include",
  surfaceSwitching: "include",
} as const;

export type PublishErrorKind = "denied" | "invalid" | "failed";

export function classifyPublishError(error: unknown): { kind: PublishErrorKind; message: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError") {
    return { kind: "denied", message: "a captura de tela foi cancelada ou negada." };
  }
  if (name === "TrackInvalidError") {
    return { kind: "invalid", message: "o navegador não devolveu nenhum quadro da captura." };
  }
  return {
    kind: "failed",
    message:
      "a captura foi liberada mas não conseguiu publicar. o servidor de transmissão não respondeu — verifique LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET no deploy.",
  };
}
