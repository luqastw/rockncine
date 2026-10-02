"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useMutation } from "@liveblocks/react";
import { useMaybeRoomContext, useLocalParticipant } from "@livekit/components-react";
import { RoomEvent, Track, type LocalTrackPublication } from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import {
  BROADCAST_HEARTBEAT_MS,
  broadcasterLabel,
  canStartBroadcast,
} from "@/lib/broadcast";

// `navigator` não muda durante a sessão: subscribe vazio, e o snapshot do
// servidor é `false` (que é o que o HTML pré-renderizado contém). Mesmo
// mecanismo de `useVideoQuality` para `isSafari`, e pela mesma razão.
//
// O botão só é renderizado onde a captura é possível (FR-010). `getDisplayMedia`
// não existe no Safari e não existe no iOS, e um botão habilitado e inerte é
// pior que botão nenhum — o defeito que o gate de resolução/FPS do
// `PlayerControls` já evitou no app.
const subscribeNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, isClient, isServer);
}

// Botão único do transmissor: iniciar e parar.
export function BroadcastControls({
  broadcast,
  userId,
  userName,
  videoSourceUrl,
}: {
  broadcast: BroadcastState | null;
  userId: string;
  userName: string;
  videoSourceUrl: string | null;
}) {
  // `useMaybeRoomContext` e não `useRoomContext`: o botão só é renderizado
  // quando `livekitUrl !== null`, o que garante o wrapper — mas o hook que
  // LANÇA sem room deixaria um erro de React no lugar de uma UI ausente, e a
  // degradação não pode depender dessa distinção.
  const room = useMaybeRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useIsClient();

  const startBroadcast = useMutation(
    ({ storage }) => {
      const now = Date.now();
      storage.set("broadcast", {
        broadcasterId: userId,
        broadcasterName: userName,
        startedAt: now,
        heartbeatAt: now,
      });
    },
    [userId, userName],
  );

  // FR-003 sem teto de duração: o transmissor renova `heartbeatAt` enquanto
  // publica, e `parseBroadcast` expira por SILÊNCIO. Sem isto, uma sessão mais
  // longa que `BROADCAST_MAX_AGE_MS` expira sozinha — o player voltava para
  // todo mundo, o botão de parar sumia, e o host ficava publicando uma track que
  // ninguém renderiza. Uma sala de cinema dura 2h+; a janela é 3 min.
  const heartbeat = useMutation(
    ({ storage }) => {
      // Só renova se ainda for o dono: se a transmissão já foi encerrada (ou
      // roubada) no caminho, resurrectar o estado seria pior que deixar expirar.
      const current = storage.get("broadcast");
      if (!current || current.broadcasterId !== userId) return;
      storage.set("broadcast", { ...current, heartbeatAt: Date.now() });
    },
    [userId],
  );

  // FR-003/FR-017/FR-019 compartilham a mesma escrita: "não há transmissão" é um
  // único estado, alcançado por botão, por `track.onended` e por saída da sala.
  const clearBroadcast = useMutation(({ storage }) => {
    storage.set("broadcast", null);
  }, []);

  const stopScreenShare = useCallback(() => {
    localParticipant.setScreenShareEnabled(false).catch(() => {
      // A track já pode ter ido (aba compartilhada fechada, permissão
      // revogada). O estado da sala é limpo de qualquer forma — o storage é a
      // autoridade, não a track.
    });
  }, [localParticipant]);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    // FR-006: a URL do vídeo abre numa aba separada ANTES do seletor. É o
    // requisito que molda o desenho inteiro — o host precisa voltar para a
    // sala para conversar enquanto o vídeo rola em outra aba — e o seletor do
    // sistema operacional precisa ter o que escolher. Só abre o que o storage
    // já tinha: nada é carregado aqui.
    if (videoSourceUrl) {
      window.open(videoSourceUrl, "_blank", "noopener");
    }

    try {
      // `setScreenShareEnabled(true, { audio: true })` é o caminho do
      // `getDisplayMedia({ video: true, audio: true })` de FR-006: é a API que o
      // Livekit expõe para publicar a track, e por dentro ela chama
      // `getDisplayMedia`. Chamar o `getDisplayMedia` à mão antes abriria um
      // segundo seletor para a mesma captura.
      //
      // As constraints abaixo vão por `options` porque o Livekit as repassa
      // literais para o `getDisplayMedia` (ver `screenCaptureToDisplayMediaStreamOptions`
      // no bundle dele) — não há camada de tradução no meio.
      //
      // `selfBrowserSurface: "exclude"` é o que impede o SALÃO DE MIRROR. Sem
      // isso o seletor oferece a aba da própria sala, e quem compartilha a sala
      // transmite a sala — recursivamente, com 1-3s de atraso do SFU por
      // generation. Não é um efeito visual: o espectador assiste uma sala se
      // multiplicando, e o host que tentou compartilhar um vídeo está
      // transmitindo o produto inteiro. O Chrome documenta isso como o "hall of
      // mirrors" e dá exatamente essa opção para impedir.
      //
      // `systemAudio: "include"` expõe a captura de áudio no seletor. O
      // requisito é "screen share com som" e no Chrome isso depende do usuário
      // marcar a caixa "compartilhar áudio"; a constraint é o que garante que a
      // opção apareça.
      //
      // `surfaceSwitching: "include"` deixa o host trocar a aba compartilhada
      // pela própria UI do Chrome, sem derrubar a transmissão: ele abre outra
      // aba, troca o que está sendo transmitido e a sala segue. É o que
      // sustenta "vídeo rola em outra aba" quando a sessão muda de filme.
      //
      // `contentHint: "detail"` porque o conteúdo compartilhado é vídeo: sem a
      // dica o encoder reduz resolução para segurar taxa de quadros, e o
      // espectador recebe a tela borrada em banda apertada.
      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        contentHint: "detail",
        selfBrowserSurface: "exclude",
        systemAudio: "include",
        surfaceSwitching: "include",
      });
      startBroadcast();
    } catch {
      // FR-008: permissão negada ou seletor cancelado. Nada é gravado no
      // storage e a UI volta ao estado anterior — o aviso existe, o modo
      // player não muda.
      setError("a captura de tela foi cancelada ou negada.");
    } finally {
      setBusy(false);
    }
  }, [busy, videoSourceUrl, localParticipant, startBroadcast]);

  const isBroadcaster = broadcast !== null && broadcast.broadcasterId === userId;

  // FR-018: a track pode acabar por qualquer motivo fora do botão — o SO
  // revoga a permissão, a aba compartilhada fecha, a página inteira crasha.
  // O `LocalTrackUnpublished` é o evento que o Livekit emite em todos esses
  // casos, e é o mesmo caminho do botão: desliga a track e zera o storage.
  useEffect(() => {
    if (!room || !isBroadcaster) return;
    const onUnpublished = (publication: LocalTrackPublication) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      stopScreenShare();
      clearBroadcast();
    };
    room.on(RoomEvent.LocalTrackUnpublished, onUnpublished);
    return () => {
      room.off(RoomEvent.LocalTrackUnpublished, onUnpublished);
    };
  }, [room, isBroadcaster, stopScreenShare, clearBroadcast]);

  // FR-003/FR-017/FR-019 compartilham a mesma escrita: "não há transmissão" é um
  // único estado, alcançado por botão, por `track.onended` e por saída da sala.
  // O intervalo do heartbeat é o quarto alcance, e é o único periódico: ele
  // existe para a transmissão NÃO expirar sozinha (ver `lib/broadcast.ts`).
  useEffect(() => {
    if (!isBroadcaster) return;
    const interval = window.setInterval(() => heartbeat(), BROADCAST_HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [isBroadcaster, heartbeat]);

  // FR-019: o transmissor que sai da sala não pode deixar `broadcast` para trás.
  // `pagehide` cobre o fechamento de aba; o cleanup do efeito cobre o unmount e
  // a navegação dentro do app. `clearBroadcast` é estável (deps `[]`), então
  // este efeito só roda de novo quando o papel de transmissor muda — que é
  // exatamente quando o cleanup deve valer.
  useEffect(() => {
    if (!isBroadcaster) return;
    const onHide = () => clearBroadcast();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      clearBroadcast();
    };
  }, [isBroadcaster, clearBroadcast]);

  if (!mounted) return null;
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    // FR-010: sem `getDisplayMedia` o botão não existe. Motivo legível em
    // texto fica no `title` dos casos em que ele existe mas está desabilitado;
    // aqui não há botão, e a ausência é a informação.
    return null;
  }

  if (isBroadcaster) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          role="status"
          className="shrink-0 rounded-full bg-[var(--invert-bg)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--invert-fg)]"
        >
          transmitindo
        </span>
        <button
          type="button"
          onClick={() => {
            stopScreenShare();
            clearBroadcast();
          }}
          aria-label="parar transmissão"
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[var(--ink-muted)] px-3 py-2 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
        >
          parar transmissão
        </button>
      </div>
    );
  }

  // FR-009/AC-004: com outra pessoa transmitindo, o botão continua visível
  // (some, não, senão a linha "pisca" na sala) mas desabilitado, e o motivo
  // do desabilitado é nomeado no `aria-label` — cinza sobre cinza não é
  // informação para quem não vê a tela.
  const otherBroadcaster =
    broadcast !== null && !canStartBroadcast(broadcast, userId) ? broadcast : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={start}
        disabled={busy || otherBroadcaster !== null}
        aria-label={
          otherBroadcaster
            ? "já há alguém transmitindo"
            : busy
              ? "abrindo o seletor de tela"
              : "iniciar transmissão de tela"
        }
        aria-busy={busy || undefined}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-[var(--ink-muted)] px-3 py-2 text-xs text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--ink-muted)]"
      >
        transmitir tela
      </button>
      {otherBroadcaster && (
        <span className="text-xs text-[var(--ink-muted)]">
          {broadcasterLabel(otherBroadcaster)} está transmitindo
        </span>
      )}
      {error && (
        <span role="status" aria-live="polite" className="text-xs text-[var(--ink-muted)]">
          {error}
        </span>
      )}
    </div>
  );
}
