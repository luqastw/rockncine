"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LiveKitRoom } from "@livekit/components-react";

// A sala é envolvida pelo `LiveKitRoom` SEMPRE, e não só quando há transmissão
// (decisão de arquitetura em docs/specs/12-transmissao-screen-share/spec.md,
// seção 7). Abrir sob demanda custaria uma rodada extra de token + negotiate
// antes de qualquer preview; aberta sempre, a transmissão começa no instante em
// que o picker fecha e dá para exibir o estado da conexão.
//
// Sem `LIVEKIT_URL` não há wrapper nenhum e a árvore da sala renderiza direto:
// o modo player não pode depender de o SFU estar configurado
// (lib/livekit.ts, degradação).

export function LiveKitProvider({
  serverUrl,
  roomCode,
  children,
}: {
  serverUrl: string | null;
  roomCode: string;
  children: ReactNode;
}) {
  // `undefined` enquanto o token não chegou. O `LiveKitRoom` aceita token
  // `undefined` e espera: passar `null` faria a biblioteca tentar conectar e
  // falhar em loop.
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!serverUrl) return;
    let cancelled = false;

    fetch("/api/livekit-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room: roomCode }),
    })
      .then((response) => (response.ok ? response.text() : null))
      .then((value) => {
        if (!cancelled) setToken(value ?? undefined);
      })
      .catch(() => {
        // Falha de rede ou rota fora do ar: a sala continua no modo player com
        // a conexão do Liveblocks de pé, que é quem carrega o storage e o
        // chat. Nada de erro fatal — o botão de transmitir continua visível e
        // o `setScreenShareEnabled` é que falha, dizendo o que aconteceu.
        if (!cancelled) setToken(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [serverUrl, roomCode]);

  if (!serverUrl) return <>{children}</>;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      // Nada é publicado ao entrar: o único áudio e o único vídeo do app são os
      // que o host capturar (FR-015). Nenhuma permissão de microfone é pedida,
      // e a captura de tela só acontece no clique do botão.
      audio={false}
      video={false}
      screen={false}
      // `display: contents` dissolve o div que o `LiveKitRoom` renderiza
      // ao redor: a casca da sala (`h-dvh` + flex) continua sendo a raiz do
      // layout. Sem isso, o `div` do Livekit viraria a caixa externa e a altura
      // da sala passaria a depender do conteúdo dele.
      style={{ display: "contents" }}
    >
      {children}
    </LiveKitRoom>
  );
}
