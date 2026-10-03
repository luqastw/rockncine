"use client";

import { useEffect, useRef, useState } from "react";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import { broadcasterLabel } from "@/lib/broadcast";

// Quanto esperar a track antes de parar de dizer que ela está chegando.
// Generoso o bastante para uma conexão lenta e para o spectator joining tarde,
// curto o bastante para a espera não virar indefiniteza sem informação.
const TRACK_WAIT_MS = 12_000;

// Área de vídeo no modo transmissão.
//
// Aqui os frames SÃO a sincronização: não há playhead, não há drift, não há
// autoridade para arbitrar (docs/specs/12-transmissao-screen-share/spec.md,
// seção 1). Por isso este componente não recebe controller, não assina o relógio
// de playback e não monta `PlayerShell`/`PlayerControls` — a track é anexada
// direto ao elemento por ref, sem CSS de terceiros.

export function ScreenSharePlayer({
  broadcast,
  onGiveUp,
}: {
  broadcast: BroadcastState;
  // Desiste de esperar e devolve a sala ao modo player, sem tocar no storage:
  // quem transmite é o dono do estado, e um espectador não pode encerrar a
  // transmissão de outra pessoa. O que o espectador faz é deixar de ESPERAR por
  // ela — se a track chegar, ela volta a aparecer.
  onGiveUp: () => void;
}) {
  // Só é montado dentro de um `LiveKitRoom` (ver o gate em `RoomExperience`):
  // o `useTracks` exige o contexto de room e LANÇA sem ele, e o valor de
  // `storage.broadcast` não prova que o Livekit esteja configurado neste
  // cliente — o storage sobrevive à queda do SFU, e o storage é exatamente o
  // que sobreviveria.
  //
  // `onlySubscribed`: o storage já diz que há transmissão, mas a track pode
  // ainda não ter chegado — o storage chega pelo Liveblocks e a mídia pelo
  // Livekit, e quem chega primeiro não é garantido. Publicação não assinada não
  // é mídia e não vira `srcObject`.
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio], {
    onlySubscribed: true,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // O storage é a autoridade sobre QUEM transmite (decisão de "onde mora o
  // estado", docs/specs/12-transmissao-screen-share/spec.md, seção 7), e a
  // identidade do Livekit é o mesmo `userId`. A segunda busca é a queda: se o
  // transmissor reconectou e a identidade ainda não casou, mostrar a track
  // existente é melhor que mostrar caixa vazia.
  const videoTrack =
    tracks.find(
      (ref) => ref.source === Track.Source.ScreenShare && ref.participant.identity === broadcast.broadcasterId,
    )?.publication.track ??
    tracks.find((ref) => ref.source === Track.Source.ScreenShare)?.publication.track;

  // FR-011: áudio é uma track separada, e ela pode simplesmente não existir.
  const audioRef = tracks.find(
    (ref) => ref.source === Track.Source.ScreenShareAudio && ref.participant.identity === broadcast.broadcasterId,
  );
  const audioTrack = audioRef?.publication.track;

  // O HOST NÃO OUVE A PRÓPRIA TRANSMISSÃO.
  //
  // Quem compartilha a aba já ouve o som dela, direto, sem latência. Se a sala
  // tambem tocasse a track devolvida pelo SFU, ele ouviria o mesmo som duas
  // vezes: uma na hora e outra com 1-2s de atraso, fora de sincronia. Isso não é
  // eco — são duas fontes do mesmo áudio em tempos diferentes, que o ouvido lê
  // como um chiado de fase.
  //
  // A checagem e `participant.isLocal` e nao comparar `identity` com `userId`: a
  // pergunta e "esta track e minha?", e o Livekit ja sabe responder isso. Todo
  // espectador tambem e participante local no seu navegador, entao "sou local"
  // sozinho nao serve -- quem decide e a track ser especificamente a própria.
  const audioEhMinha = audioRef?.participant.isLocal === true;
  // O que este espectador vai ouvir. Para o host, nada: o som esta na aba.
  const audioParaAssistir = audioEhMinha ? null : audioTrack;

  // FR-011/FR-012: cada `MediaStreamTrack` no seu elemento. `muted` no `<video>`
  // é obrigatório: sem ele o navegador bloqueia o autoplay e o espectador vê
  // um quadro congelado sem som nenhum, que é indistinguível de transmissão
  // quebrada. O som sai pelo `<audio>`.
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !videoTrack) return;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  useEffect(() => {
    const element = audioElRef.current;
    if (!element || !audioParaAssistir) return;
    audioParaAssistir.attach(element);
    return () => {
      audioParaAssistir.detach(element);
    };
  }, [audioParaAssistir]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        // O conteúdo da track não é texto acessível; o estado da transmissão é
        // que se anuncia, e ele está no texto abaixo.
        aria-hidden
        className="h-full w-full bg-black object-contain"
      />
      <audio ref={audioElRef} autoPlay />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-2">
        <span
          role="status"
          className="rounded-full bg-[var(--invert-bg)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--invert-fg)]"
        >
          transmitindo
        </span>
        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--ink)]">
          {broadcasterLabel(broadcast)}
        </span>
      </div>
      {!videoTrack && (
        <TrackWait broadcast={broadcast} onGiveUp={onGiveUp} />
      )}

      {/* FR-013/FR-016: `getDisplayMedia` com áudio é Chrome/Edge; no Firefox
          a captura vem só em vídeo. O aviso é explícito e não é tratado como
          erro — o vídeo continua tocando normalmente. Só aparece depois que a
          track de vídeo existe: enquanto ela não chegou, "sem áudio" seria uma
          afirmação que ninguém pode verificar. */}
      {videoTrack && !audioTrack && !audioEhMinha && (
        <p
          role="status"
          aria-live="polite"
          className="absolute inset-x-0 bottom-0 bg-[var(--scrim)] px-3 py-2 text-center text-xs text-[var(--ink)]"
        >
          esta transmissão está sem áudio — o navegador não capturou o som da aba
        </p>
      )}

      {/* O host não ouve o áudio aqui de propósito (ver `audioEhMinha`). Dizer isso
          é o que separa "o áudio foi desativado" de "o áudio quebrou": sem esta
          linha o transmissor ouve o som na aba compartilhada, não ouve aqui, e
          conclui que a transmissão perdeu o áudio. */}
      {videoTrack && audioEhMinha && (
        <p
          role="status"
          className="absolute inset-x-0 bottom-0 bg-[var(--scrim)] px-3 py-2 text-center text-xs text-[var(--ink)]"
        >
          o som toca na aba que você está compartilhando, não aqui
        </p>
      )}
    </div>
  );
}

// Espera pelos quadros, com prazo e escotilha.
//
// Mountar este componente É o início da espera, e desmontar é o fim. O estado
// nasce `false` porque acabou de nascer — não precisa de `useEffect` para
// rezerar, e não há o risco de a flag "espera vencida" vazar do período
// anterior para o seguinte quando a track flapa (chega, some, chega de novo).
// O ciclo de vida do estado é exatamente o ciclo de vida da condição.
//
// O texto é honesto nas duas pontas: enquanto há prazo, diz que está chegando;
// depois do prazo, diz que NÃO chegou e devolve o controle. "conectando" sem
// prazo é indistinguível de "quebrado", e sem escotilha o espectador fica preso
// numa caixa que nunca preenche.
function TrackWait({ broadcast, onGiveUp }: { broadcast: BroadcastState; onGiveUp: () => void }) {
  const [waitOver, setWaitOver] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setWaitOver(true), TRACK_WAIT_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!waitOver) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">
          conectando à transmissão
        </p>
        <p className="text-sm text-[var(--ink-muted)]">os quadros chegam em instantes</p>
      </div>
    );
  }

  // A espera venceu e nada chegou. As causas reais são três, e nenhuma é culpa
  // de quem assiste: o host fechou a aba compartilhada, a permissão foi revogada
  // pelo sistema, ou alguém escreveu o estado de transmissão sem publicar track.
  // A tela não escolhe culpado — diz o que está acontecendo e devolve o controle.
  // A queda NÃO é automática: se a track chegar depois, a transmissão volta, e
  // uma sala que ninguém escolheu sair é pior do que uma sala esperando.
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">
        a transmissão não chegou
      </p>
      <p className="text-sm text-[var(--ink-muted)]">
        {broadcasterLabel(broadcast)} marcou que está transmitindo, mas os quadros não chegaram. a aba
        compartilhada pode ter sido fechada.
      </p>
      <button
        type="button"
        onClick={onGiveUp}
        className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-4 py-2 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        voltar ao player
      </button>
      <p className="text-xs text-[var(--ink-muted)]">
        se {broadcasterLabel(broadcast)} ainda estiver transmitindo, os quadros voltam sozinhos.
      </p>
    </div>
  );
}
