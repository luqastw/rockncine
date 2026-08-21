"use client";

// Fonte sem API de controle exposta via postMessage — carrega o link como
// iframe puro, sem sync de play/pause/seek (ver SPEC.md seção 7).
export function GenericIframe({ src }: { src: string }) {
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
