"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useMutation } from "@liveblocks/react";
import {
  useConnectionState,
  useMaybeRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type LocalTrackPublication,
} from "livekit-client";
import type { BroadcastState } from "@/liveblocks.config";
import { useLiveKitAuth } from "@/components/room/LiveKitProvider";
import { useBroadcastQuality } from "@/hooks/useBroadcastQuality";
import {
  BROADCAST_QUALITIES,
  BROADCAST_QUALITY_LEVELS,
  broadcastQuality,
  type BroadcastQualityLevel,
} from "@/lib/broadcast-quality";
import { useLiveKitFailure } from "@/components/room/LiveKitProvider";
import { sfuFailureHint } from "@/lib/sfu-connect";
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
  const connection = useConnectionState();
  const auth = useLiveKitAuth();
  // Qualidade da transmissão: escolha do host, local e persistente. Só entra no
  // momento de publicar — a track já criada não troca de preset sem republicar,
  // e republicar derrubaria a transmissão no meio do filme.
  const { level: qualityLevel, setQuality } = useBroadcastQuality();
  const quality = broadcastQuality(qualityLevel);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useIsClient();

  // O botão só habilita com o SFU CONECTADO, e não apenas com a credencial em
  // mãos. São duas coisas: `auth.ready` diz que o token chegou, `connected` diz
  // que o WebSocket subiu e a room existe. Publicar exige as duas.
  //
  // Sem este gate, o caminho era: token pendente → botão habilitado → clique →
  // o SO concede a captura (e o banner de "compartilhando" aparece, fazendo o
  // usuário acreditar que funcionou) → a publicação falha porque não há room →
  // o erro cai no `catch` genérico. O usuário fica com a tela compartilhada e
  // ninguém recebendo, e o app o acusa de ter cancelado.
  const connected = connection === ConnectionState.Connected;
  // Motivo legível para o botão desabilitado. É o que torna o estado de
  // configuração diagnosticável sem DevTools — o `httpStatus` da rota diz se é
  // env var faltando (503), sessão (401) ou permissão na sala (403).
  const blockedReason = (() => {
    if (auth.status === "unavailable") {
      if (auth.httpStatus === 503) return "transmissão não configurada neste deploy";
      if (auth.httpStatus === 403) return "você não pode transmitir nesta sala";
      if (auth.httpStatus === 401) return "sessão expirada — recarregue a sala";
      return "servidor de transmissão indisponível";
    }
    if (auth.status !== "ready") return "conectando ao servidor de transmissão";
    // Um estado por estado. Colapsar `connecting` em "sem conexão" diz ao
    // usuário que algo quebrou quando o WebSocket pode estar apenas subindo —
    // e foi exatamente esse o caso que veio do primeiro teste em produção, em que
    // a sala acusava uma falha que ainda não tinha acontecido.
    if (connection === ConnectionState.Connecting) return "conectando ao servidor de transmissão";
    if (connection === ConnectionState.Reconnecting) return "reconectando ao servidor de transmissão";
    if (!connected) return "sem conexão com o servidor de transmissão";
    return null;
  })();

  // O motivo da falha de conexão, quando houve. Sem ele a tela diz "sem conexão",
  // que não é informação. Vem do `connect` que o `ConnectGate` executa, porque
  // `ConnectionStateChanged` não traz motivo e `LiveKitRoom` não tem `onError`.
  const failure = useLiveKitFailure();
  const livekitReason = (() => {
    if (!failure || connected) return null;
    // O status é um FATO e vai separado da dica: a dica é uma hipótese com ação
    // (chaves de outro projeto), o status é o que o servidor respondeu. Misturar
    // os dois numa frase só faria a dica afirmar um 401 que não houve.
    const status = failure.httpStatus === null ? [] : [`status ${failure.httpStatus}`];
    return [...status, sfuFailureHint(failure), failure.detail].filter(Boolean).join(" · ");
  })();

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

  // Devolve a promise para que quem chama possa esperar o desligamento. A
  // captura que sobra é o pior estado possível desta feature — o SO continua
  // enviando a tela e o app não diz nada — então a limpeza na falha precisa
  //aguardar, não disparar e seguir.
  const stopScreenShare = useCallback(async () => {
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch {
      // A track já pode ter ido (aba compartilhada fechada, permissão
      // revogada). O estado da sala é limpo de qualquer forma — o storage é a
      // autoridade, não a track.
    }
  }, [localParticipant]);

  const start = useCallback(async () => {
    if (busy) return;
    // Guarda no início, e não só na UI: `blockedReason` pode virar não-nulo
    // entre o clique e a execução do handler, e pedir captura ao SO sem SFU
    // conectado é exatamente o caminho que deixa a tela do usuário compartilhada
    // com ninguém recebendo.
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
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
      // `contentHint: "motion"`, e não `"detail"`. Pela spec WebRTC, `detail`
      // manda o encoder preservar detalhe AO CUSTO da taxa de quadros — foi feito
      // para texto e arte vetorial. Para vídeo é o oposto do que serve: foi
      // exatamente o que fez a transmissão parecer travada, com o encoder
      // segurando nitidez e dropping frames. O próprio Livekit força `motion` em
      // screen share porque o caminho `detail` é "untested/buggy".
      //
      // A qualidade, essa sim, éResolution/bitrate — a alavanca certa para
      // banda apertada, e por isso uma escolha do host (lib/broadcast-quality.ts).
      //
      // `resolution` sem valor explícito vira `ScreenSharePresets.h1080fps30`
      // (1920x1080, 5 Mbps). Esse é o default do Livekit e não serve para
      // watch party em banda residencial: 5 Mbps de upstream é o suficiente para
      // frames descartados, que aparecem como travamento.
      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        contentHint: "motion",
        resolution: quality.preset,
        selfBrowserSurface: "exclude",
        systemAudio: "include",
        surfaceSwitching: "include",
      });
      startBroadcast();
    } catch (error: unknown) {
      // A distinção que o `catch` genérico apagava: cancelamento é decisão do
      // usuário, falha de publicação é problema do deploy. Atribuir ao usuário
      // um erro de configuração é pior que não dizer nada — ele refaz o
      // procedimento inteiro e chega ao mesmo resultado.
      //
      // O Livekit normaliza "picker dispensado" e "permissão negada" para o
      // nome `NotAllowedError` (ver o shim em `createScreenTracks` no bundle
      // dele), então esse nome é a fronteira confiável entre os dois casos — e
      // ele tem de ser lido ANTES de qualquer limpeza, porque decide se há
      // alguma coisa para limpar.
      const nome = error instanceof Error ? error.name : "";
      if (nome === "NotAllowedError") {
        // `getDisplayMedia` não resolveu: nada foi capturado, e desligar uma
        // captura que não existe seria falar do estado do SO sem saber dele.
        setError("a captura de tela foi cancelada ou negada.");
        return;
      }

      // Aqui a captura pode ter sido CONCEDIDA e a publicação falhar depois. O
      // `getDisplayMedia` acontece dentro do `setScreenShareEnabled`, e o SO já
      // cedeu a tela quando a publicação estoura. Sem esta limpeza, o usuário
      // fica com o banner de "compartilhando" ligado, a tela indo para o SO e
      // ninguém recebendo — que é o pior estado possível desta feature.
      await stopScreenShare();
      console.error("[transmissão] falha ao publicar a track de tela", error);
      setError(
        nome === "TrackInvalidError"
          ? "o navegador não devolveu nenhum quadro da captura."
          : "a captura foi liberada mas não conseguiu publicar. o servidor de transmissão não respondeu — verifique LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET no deploy.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, blockedReason, videoSourceUrl, localParticipant, quality, startBroadcast, stopScreenShare]);

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

  // A qualidade é um controle ÚNICO, montado antes dos dois returns abaixo.
  // Ele precisa aparecer nos dois ramos — inclusive transmitindo, onde fica
  // desabilitado. Teria ficado só no ramo de não-transmissor se fosse escrito
  // inline lá dentro, que é como o componente ramifica.
  const seletorQualidade = (
    <label
      className={`flex items-center gap-1 text-xs ${
        isBroadcaster ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"
      }`}
    >
      <span className="sr-only sm:not-sr-only">qualidade</span>
      <select
        value={qualityLevel}
        disabled={isBroadcaster}
        onChange={(event) => setQuality(event.target.value as BroadcastQualityLevel)}
        aria-label={
          isBroadcaster
            ? "a qualidade só muda na próxima transmissão"
            : `qualidade da transmissão: ${quality.detail}`
        }
        className="min-h-11 rounded-md border border-[var(--ink-muted)] bg-transparent px-2 py-1 text-xs text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)] disabled:cursor-not-allowed disabled:border-[var(--line)] disabled:text-[var(--ink-muted)]"
      >
        {BROADCAST_QUALITY_LEVELS.map((level) => (
          <option key={level} value={level}>
            {BROADCAST_QUALITIES[level].label}
          </option>
        ))}
      </select>
    </label>
  );

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
        {/* A track já foi criada com o preset escolhido; trocar exigiria
            republicar, o que derrubaria a transmissão no meio do filme. O motivo
            do desabilitado é nomeado, pelo mesmo motivo do botão de FR-009:
            cinza sobre cinza não é informação. */}
        {seletorQualidade}
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
        disabled={busy || otherBroadcaster !== null || blockedReason !== null}
        aria-label={
          otherBroadcaster
            ? "já há alguém transmitindo"
            : blockedReason
              ? blockedReason
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
      {/* O motivo do SFU indisponível fica visível, e não só no `aria-label`:
          quem está com a configuração errada no deploy precisa ver isso sem
          abrir o DevTools, e o botão desabilitado sozinho parece decisão da
          sala. Some quando há transmissão alheia — aí o motivo já é outro. */}
      {blockedReason && !otherBroadcaster && auth.status !== "disabled" && (
        <span role="status" aria-live="polite" className="text-xs text-[var(--ink-muted)]">
          {blockedReason}
          {livekitReason && ` — ${livekitReason}`}
        </span>
      )}
      {seletorQualidade}
      {error && (
        <span role="status" aria-live="polite" className="text-xs text-[var(--ink-muted)]">
          {error}
        </span>
      )}
    </div>
  );
}
