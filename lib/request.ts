// Checagem de origem para rotas de escrita.
//
// Um `Origin` presente que não seja interpretável (incluindo `null`, de iframe
// em sandbox) não pode ser confirmado como mesma origem, então conta como
// divergência.
//
// A função vivia dentro de `app/api/rooms/[code]/route.ts` e agora é
// compartilhada: as duas rotas que escrevem (DELETE da sala, PATCH do vídeo)
// precisam da mesma checagem, e duas cópias divergem.

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;

  try {
    // `host` antes de `req.url`: atrás de proxy é o cabeçalho que carrega o
    // host público usado pelo browser para montar o `Origin`.
    const requestHost = req.headers.get("host") ?? new URL(req.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}
