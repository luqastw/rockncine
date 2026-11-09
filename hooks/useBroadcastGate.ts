"use client";

import { useCallback, useState } from "react";
import { useStorage } from "@liveblocks/react";
import { parseBroadcast } from "@/lib/broadcast";

export function useBroadcastGate(livekitUrl: string | null) {
  // Estado de transmissão, no storage do Liveblocks e não em memória: é o que
  // chega para quem entra depois sem esperar evento
  // (FR-014, docs/specs/12-transmissao-screen-share/spec.md). O valor cru pode
  // ser `undefined` numa sala criada antes deste campo existir, e pode ser
  // qualquer coisa se um cliente escrever malformado — o parser é a fronteira e
  // devolve `null` (AC-009), que é o modo player.
  const rawBroadcast = useStorage((root) => root.broadcast);
  const broadcast = parseBroadcast(rawBroadcast);
  // O `livekitUrl` entra no gate junto com o storage, e não só para esconder o
  // botão: `ScreenSharePlayer` usa `useTracks`, que exige o contexto de room e
  // LANÇA sem ele. O storage sobrevive à queda do Livekit — ele é o que
  // sobrevive —, então `broadcast !== null` sozinho não prova que o SFU está de
  // pé neste cliente. Sem wrapper, o modo player é o estado correto e é o que a
  // sala mostra.
  const isBroadcasting = broadcast !== null && livekitUrl !== null;

  // "Desisti de esperar a transmissão" é estado LOCAL de quem assiste, não
  // estado da sala: o storage continua dizendo que há transmissão, e se a track
  // chegar depois ela volta a ser exibida. Só o transmissor encerra transmissão
  // (FR-017/FR-019) — um espectador que sai da espera não cancela a transmissão
  // de outra pessoa, e mexer no storage aqui seria tomar uma decisão que não é
  // dele.
  //
  // Zera sozinha quando a transmissão termina ou quando outra começa, sem
  // efeito: a escotilha guarda A QUAL transmissão ela se refere, e a validade é
  // derivada comparando com a chave da transmissão atual. Uma escotilha é
  // decisão sobre UMA transmissão — sobreviver à seguinte seria prender o
  // espectador numa sala que ele já escolheu não ver.
  //
  // `startedAt` entra na chave porque ele é escrito uma vez por transmissão, ao
  // contrário de `broadcasterId`: só o id não distinguiria "desisti da
  // transmissão do bruno" de "desisti da transmissão do bruno", quando a segunda
  // é uma transmissão nova e a escotilha antiga não vale. Reset por `useEffect`
  // resolveria, mas cascateia render e o valor é derivável — derivar é mais
  // barato que sincronizar.
  const broadcastKey = broadcast === null ? null : `${broadcast.broadcasterId}:${broadcast.startedAt}`;
  const [gaveUpFor, setGaveUpFor] = useState<string | null>(null);
  const gaveUpOnBroadcast = gaveUpFor !== null && gaveUpFor === broadcastKey;
  const giveUpOnBroadcast = useCallback(() => setGaveUpFor(broadcastKey), [broadcastKey]);
  const showScreenShare = isBroadcasting && !gaveUpOnBroadcast;

  return { broadcast, isBroadcasting, showScreenShare, giveUpOnBroadcast };
}
