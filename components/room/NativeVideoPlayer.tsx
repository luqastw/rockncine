"use client";

// <video> cru não tem chrome nenhum por padrão — diferente do YouTube/Vimeo,
// não precisa esconder nenhum controle nativo explicitamente.
export function NativeVideoPlayer({ containerId }: { containerId: string }) {
  return <video id={containerId} className="h-full w-full" playsInline />;
}
