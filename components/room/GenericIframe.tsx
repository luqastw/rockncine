"use client";

import { isSafeEmbedUrl } from "@/lib/video-source";

// Fonte sem API de controle exposta via postMessage — carrega o link como
// iframe puro, sem sync de play/pause/seek (ver docs/specs/01-fundacao-mvp/spec.md, seção 7).
export function GenericIframe({ src }: { src: string }) {
  // `video.embedUrl` no storage do Liveblocks é escrito por qualquer membro
  // da sala (controle compartilhado — decisão travada) e pode chegar aqui
  // sem ter passado por `resolveVideoUrl` (achado 5, docs/specs/04-auditoria-ui-ux-rodada-2/spec.md).
  // Recusar aqui, no ponto de renderização, é a única defesa que cobre todo
  // caminho de escrita, não só o PATCH server-side.
  if (!isSafeEmbedUrl(src)) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-[var(--ink-muted)]">
        link inválido pra incorporação.
      </div>
    );
  }

  return (
    <iframe
      src={src}
      // iframe sem nome acessível é anunciado como "frame" sem contexto
      // nenhum por leitor de tela (achado 18 da auditoria).
      title="player de vídeo incorporado"
      className="h-full w-full"
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; fullscreen; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
