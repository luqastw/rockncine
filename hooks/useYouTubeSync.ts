"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import { loadYouTubeIframeApi } from "@/lib/youtube-iframe";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import {
  getPlaybackSnapshot,
  resetPlaybackClock,
  setPlayback,
} from "@/hooks/usePlaybackClock";
import {
  expectedPlaybackTime,
  DRIFT_THRESHOLD_YOUTUBE_S,
  CHECK_INTERVAL_MS,
  SEEK_WHILE_PAUSED_THRESHOLD_S,
  REMOTE_APPLY_COOLDOWN_MS,
  type PlaybackController,
} from "@/hooks/playerController";
import { parsePlayerEvent, shouldApplyPlayerEvent } from "@/lib/playback/events";
import { skewFor, updateSkew, type SkewSamples } from "@/lib/playback/clock";

const TIME_POLL_MS = 400; // YT API não emite timeupdate — só leitura pra UI do scrubber

function youtubeErrorMessage(code: YT.PlayerError): string {
  switch (code) {
    case 100:
      return "vídeo não encontrado ou privado.";
    case 101:
    case 150:
      return "o dono deste vídeo não permite reprodução embutida (comum em vídeos com restrição de idade).";
    default:
      return "não foi possível reproduzir este vídeo.";
  }
}

export function useYouTubeSync({
  containerId,
  userId,
  captions = false,
}: {
  containerId: string;
  userId: string;
  // Preferência local de legenda. Fica no hook (e não no `controller`) porque
  // não é controle do player: é uma chave de playerVar + um efeito sobre a
  // API, com dono no `useVideoQuality` — igual a resolução/FPS.
  captions?: boolean;
}) {
  const video = useStorage((root) => root.video);
  const playerStorage = useStorage((root) => root.player);
  const playerStorageRef = useRef(playerStorage);
  useEffect(() => {
    playerStorageRef.current = playerStorage;
  }, [playerStorage]);

  const broadcast = useBroadcastEvent();

  const commitPlayer = useMutation(({ storage }, player: RoomStorage["player"]) => {
    storage.update({ player });
  }, []);

  const playerRef = useRef<YT.Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  // desvio de relógio estimado por ator e maior `ts` já aplicado (last-write-wins)
  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);

  // Estado do player vai para a store externa (`usePlaybackClock`), não para
  // `useState` aqui dentro.
  //
  // A diferença é o efeito em cascata: o polling abaixo roda a cada 400 ms
  // (a API do YouTube não emite `timeupdate`), e um `useState` aqui
  // re-renderizaria `RoomExperience` e a subárvore inteira — chat com 30 itens,
  // presença, sync ring — 2,5 vezes por segundo, sem nada naqueles
  // componentes ter mudado. Ver `hooks/usePlaybackClock.ts`.
  //
  // `isReady` e `error` continuam em `useState`: mudam em transições, não em
  // fluxo, e `RoomExperience` precisa deles no render para escolher a tela.
  const setIsPlayingLocal = useCallback((isPlaying: boolean) => setPlayback({ isPlaying }), []);
  const setCurrentTime = useCallback((currentTime: number) => setPlayback({ currentTime }), []);
  const setDuration = useCallback((duration: number) => setPlayback({ duration }), []);
  const setVolumeLocal = useCallback((volume: number) => setPlayback({ volume }), []);
  const setIsMutedLocal = useCallback((isMuted: boolean) => setPlayback({ isMuted }), []);

  // Zera o relógio ao desmontar: a store é de módulo e sobrevive à sala.
  useEffect(() => resetPlaybackClock, []);

  // YouTube IFrame API não retorna Promise — timeout de fallback (1500ms)
  // garante que o flag não fica preso se onStateChange não disparar (spec 08, CA1.2).
  const applyRemote = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, REMOTE_APPLY_COOLDOWN_MS);
  }, []);

  // Desligar legenda e LIGAR legenda são dois casos, e o de desligar é o que
  // exige os reforços:
  //
  // unloadModule sozinho não é suficiente: a API pode recarregar o módulo
  // "captions" com uma faixa auto-selecionada (ASR, pelo idioma do
  // navegador) depois do unload, sem disparar `onApiChange` de novo —
  // confirmado via `getOption('captions', 'track')` no console mostrando
  // uma faixa ativa mesmo após o unload (achado pós-deploy, 14.7). Limpar a
  // faixa explicitamente com `setOption('captions', 'track', {})` é o que
  // de fato zera a exibição.
  //
  // O comportamento era fixo e sem volta: o app é cinematico e o desligamento
  // forçado tirava de quem precisa de legenda o único caminho para obtê-la
  // (WCAG 1.2.2). Agora `captions` decide o alvo e o efeito abaixo reage à
  // virada — o default continua sendo desligado, que é o comportamento que o
  // produto escolheu.
  const captionsRef = useRef(captions);
  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  const applyCaptionPreference = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (captionsRef.current) {
      // `loadModule` é o caminho documentado para tornar o módulo de legenda
      // (e o botão de CC) disponível. `track` fica vazio: o YouTube escolhe a
      // faixa preferida, e a lista de opções continua acessível pelo botão
      // nativo que este módulo habilita.
      player.loadModule("captions");
      return;
    }
    player.unloadModule("captions");
    player.setOption("captions", "track", {});
  }, []);

  // cria/atualiza o player quando o video.embedUrl (videoId) ou loadedAt do
  // storage muda. loadedAt muda a cada "carregar" mesmo pra URL idêntica —
  // sem isso, recarregar o mesmo link não reexecutava este efeito (deps
  // inalteradas) e a retentativa virava um no-op silencioso.
  useEffect(() => {
    if (!video?.embedUrl || video.source !== "YOUTUBE") {
      // saiu do YouTube pra outra fonte: o container #yt-player é desmontado
      // pelo RoomExperience, então o player preso na ref antiga ficaria
      // apontando pra um nó DOM morto. Destrói e limpa a ref agora, senão um
      // load futuro de YouTube reusa essa ref morta em vez de criar um player
      // novo contra o container recém-montado.
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
        loadedVideoIdRef.current = null;
        setIsReady(false);
      }
      return;
    }
    const videoId = video.embedUrl;
    let cancelled = false;

    loadYouTubeIframeApi().then(() => {
      if (cancelled) return;
      setError(null); // reinicia o estado de erro pra cada novo vídeo carregado

      if (playerRef.current) {
        applyRemote(() => playerRef.current!.loadVideoById(videoId));
        loadedVideoIdRef.current = videoId;
        // NÃO chamar unloadModule("captions") aqui: o módulo de legenda só
        // fica disponível depois que a API dispara `onApiChange` (registrado
        // abaixo, uma vez, na criação do player — o handler sobrevive a
        // loadVideoById porque é o mesmo objeto Player). Chamar antes disso
        // é no-op — o módulo ainda nem carregou.
        return;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        width: "100%",
        height: "100%",
        // cc_load_policy: 0 NÃO desliga legenda — a IFrame Player API só
        // documenta efeito pro valor 1 (força legenda ligada); omitido ou 0
        // caem em "preferência do usuário", que é justo o comportamento
        // relatado como bug. Mantido por documentar a intenção, mas a
        // correção real é descarregar o módulo "captions" via onApiChange
        // abaixo, que dispara de novo a cada troca de vídeo (loadVideoById).
        playerVars: { autoplay: 0, playsinline: 1, rel: 0, controls: 0, disablekb: 1, cc_load_policy: 0 },
        events: {
          onApiChange: () => {
            // dispara sempre que um módulo com API exposta (ex. "captions")
            // fica disponível — inclusive de novo a cada loadVideoById.
            applyCaptionPreference();
          },
          onReady: () => {
            loadedVideoIdRef.current = videoId;
            setIsReady(true);
            setDuration(playerRef.current!.getDuration());
            setVolumeLocal(playerRef.current!.getVolume() / 100);
            setIsMutedLocal(playerRef.current!.isMuted());

            // late join: aplica o snapshot atual do storage em vez de esperar broadcast
            const snapshot = playerStorageRef.current;
            if (snapshot) {
              const { time, shouldPlay } = expectedPlaybackTime(
                snapshot,
                playerRef.current!.getDuration(),
                skewFor(skewRef.current, snapshot.lastActorId),
              );
              applyRemote(() => {
                playerRef.current!.seekTo(time, true);
                if (shouldPlay) playerRef.current!.playVideo();
                else playerRef.current!.pauseVideo();
              });
              setIsPlayingLocal(shouldPlay);
              // seekTo/playVideo pode fazer a API reselecionar uma faixa de
              // legenda (achado real: funcionava pra quem cria a sala, sem
              // snapshot/seek; falhava pra quem entra depois com o vídeo já
              // tocando — achado pós-deploy, 14.7). Reforça logo após o seek
              // e de novo com atraso, pro caso do reload ser assíncrono.
              applyCaptionPreference();
              window.setTimeout(applyCaptionPreference, 500);
            }
          },
          onError: (e) => {
            setError(youtubeErrorMessage(e.data));
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setIsPlayingLocal(true);
              // reforço final: a faixa de legenda pareceu ser reselecionada
              // em pontos não previstos pelos dois reforços acima (achado
              // pós-deploy, 14.7) — chamada idempotente, sem custo real.
              applyCaptionPreference();
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              setIsPlayingLocal(false);
            }

            if (isApplyingRemoteRef.current) return;
            const player = playerRef.current;
            if (!player) return;

            if (e.data === window.YT.PlayerState.PLAYING) {
              const time = player.getCurrentTime();
              const evt: PlayerEvent = {
                type: "PLAY",
                time,
                source: "YOUTUBE",
                actorId: userId,
                ts: Date.now(),
              };
              lastAppliedTsRef.current = evt.ts;
              commitPlayer({
                isPlaying: true,
                currentTime: time,
                updatedAt: evt.ts,
                lastActorId: userId,
              });
              broadcast(evt);
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              const time = player.getCurrentTime();
              const evt: PlayerEvent = {
                type: "PAUSE",
                time,
                source: "YOUTUBE",
                actorId: userId,
                ts: Date.now(),
              };
              lastAppliedTsRef.current = evt.ts;
              commitPlayer({
                isPlaying: false,
                currentTime: time,
                updatedAt: evt.ts,
                lastActorId: userId,
              });
              broadcast(evt);
            }
          },
        },
      });
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(
        err instanceof Error
          ? `${err.message} tente carregar o vídeo de novo.`
          : "falha ao carregar o player do YouTube. tente carregar o vídeo de novo.",
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.embedUrl, video?.source, video?.loadedAt, containerId, userId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  // Virada da preferência de legenda em runtime. `onApiChange` sozinho não
  // basta: ele só dispara quando um módulo fica disponível, e quem LIGA
  // legenda precisa de `loadModule`, que é exatamente o que dispara o
  // `onApiChange` — mas o efeito de criação do player não roda de novo, então
  // este é o caminho que responde ao clique no botão.
  //
  // Fica fora das deps do efeito de criação de propósito: com `captions` lá,
  // alternar a preferência recriaria o player e recarregaria o vídeo no meio
  // da sessão de todo mundo.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReady) return;
    applyCaptionPreference();
  }, [captions, isReady, applyCaptionPreference]);

  // aplica PLAY/PAUSE/SEEK vindos de outros participantes
  useEventListener(({ event }) => {
    // O payload chega de outro cliente e vira `seekTo` direto: passa por
    // validação de formato antes de qualquer coisa (lib/playback/events).
    const parsed = parsePlayerEvent(event);
    if (!parsed) return;

    // Alimenta a estimativa de desvio de relógio com o `ts` do remetente.
    skewRef.current = updateSkew(skewRef.current, parsed.actorId, parsed.ts, Date.now());

    const player = playerRef.current;
    if (!player) return;

    if (
      !shouldApplyPlayerEvent(parsed, {
        selfId: userId,
        localSource: "YOUTUBE",
        lastAppliedTs: lastAppliedTsRef.current,
      })
    ) {
      return;
    }
    lastAppliedTsRef.current = parsed.ts;

    applyRemote(() => {
      if (parsed.type === "PLAY") {
        player.seekTo(parsed.time, true);
        player.playVideo();
        setIsPlayingLocal(true);
      } else if (parsed.type === "PAUSE") {
        player.seekTo(parsed.time, true);
        player.pauseVideo();
        setIsPlayingLocal(false);
      } else if (parsed.type === "SEEK") {
        player.seekTo(parsed.time, true);
      }
    });
  });

  // polling leve só pra UI (scrubber/tempo) — API do YouTube não emite
  // evento de progresso, diferente do Vimeo/<video> nativo.
  useEffect(() => {
    if (!isReady) return;
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setCurrentTime(player.getCurrentTime());
        setDuration(player.getDuration());
      } catch {
        // player pode estar num estado transitório entre troca de vídeo
      }
    }, TIME_POLL_MS);
    return () => window.clearInterval(interval);
  }, [isReady, setCurrentTime, setDuration]);

  // drift correction (seguidores) + detecção de seek-enquanto-pausado (quem controla)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      const snapshot = playerStorageRef.current;
      if (!player || !snapshot || !isReady) return;
      if (isApplyingRemoteRef.current) return;

      let localTime: number;
      try {
        localTime = player.getCurrentTime();
      } catch {
        return;
      }

      const { time: expected, stale } = expectedPlaybackTime(
        snapshot,
        // Lido da store no instante do tick, e não de um `duration` capturado
        // no render: com o estado fora do React, um valor de closure ficaria
        // congelado e o clamp por duração pararia de valer depois do primeiro
        // load.
        getPlaybackSnapshot().duration,
        skewFor(skewRef.current, snapshot.lastActorId),
      );
      if (stale) return; // snapshot abandonado: não arrasta ninguém (ver playerController)
      const diff = localTime - expected;
      const isOwner = snapshot.lastActorId === userId;
      const isPaused = player.getPlayerState() === window.YT.PlayerState.PAUSED;

      if (isOwner && isPaused && Math.abs(diff) > SEEK_WHILE_PAUSED_THRESHOLD_S) {
        const evt: PlayerEvent = {
          type: "SEEK",
          time: localTime,
          source: "YOUTUBE",
          actorId: userId,
          ts: Date.now(),
        };
        lastAppliedTsRef.current = evt.ts;
        commitPlayer({
          isPlaying: false,
          currentTime: localTime,
          updatedAt: evt.ts,
          lastActorId: userId,
        });
        broadcast(evt);
        return;
      }

      if (!isOwner && Math.abs(diff) > DRIFT_THRESHOLD_YOUTUBE_S) {
        applyRemote(() => player.seekTo(expected, true));
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
    // `duration` sai das deps de propósito: com o estado do player na store
    // externa, este efeito não re-assina a cada tick — e `expectedPlaybackTime`
    // já é clampado pela duração que o próprio player fornece.
  }, [isReady, userId, commitPlayer, broadcast, applyRemote]);

  // controles imperativos — chamados pela nossa própria barra (chrome nativo
  // do YouTube fica escondido via controls:0/disablekb:1). Os listeners acima
  // (onStateChange) já cuidam de commit+broadcast quando o estado muda de
  // fato; aqui só disparamos a ação no player, exceto seek(), que precisa de
  // broadcast explícito próprio — a API do YouTube não emite evento de seek.
  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const togglePlay = useCallback(() => {
    // Lido da store, não de `isPlayingLocal`: o comando tem que decidir pelo
    // estado real no instante do clique. `onStateChange` do YouTube é
    // assíncrono, então entre o clique e o evento existe uma janela em que o
    // estado local mente — e era nessa janela que um clique duplo invertia a
    // reprodução duas vezes em vez de parar.
    if (getPlaybackSnapshot().isPlaying) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  }, []);

  const seek = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      player.seekTo(seconds, true);
      setCurrentTime(seconds);
      const evt: PlayerEvent = {
        type: "SEEK",
        time: seconds,
        source: "YOUTUBE",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
      commitPlayer({
        isPlaying: player.getPlayerState() === window.YT.PlayerState.PLAYING,
        currentTime: seconds,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    },
    [userId, commitPlayer, broadcast, setCurrentTime],
  );

  const setVolume = useCallback(
    (v: number) => {
      playerRef.current?.setVolume(Math.round(v * 100));
      setVolumeLocal(v);
      if (v > 0) {
        playerRef.current?.unMute();
        setIsMutedLocal(false);
      }
    },
    [setVolumeLocal, setIsMutedLocal],
  );

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    // Lido da store no instante do clique, não de um valor de closure.
    if (getPlaybackSnapshot().isMuted) {
      player.unMute();
      setIsMutedLocal(false);
    } else {
      player.mute();
      setIsMutedLocal(true);
    }
  }, [setIsMutedLocal]);

  // Campos de estado como GETTERS sobre a store, não valores copiados: a
  // leitura imperativa (teclado, drift correction) tem que ver o valor do
  // instante da chamada, e quem precisa REAGIR assina a store por hook.
  // Ver `hooks/usePlaybackClock.ts`.
  const controller: PlaybackController = {
    isReady,
    get isPlaying() {
      return getPlaybackSnapshot().isPlaying;
    },
    get currentTime() {
      return getPlaybackSnapshot().currentTime;
    },
    get duration() {
      return getPlaybackSnapshot().duration;
    },
    get volume() {
      return getPlaybackSnapshot().volume;
    },
    get isMuted() {
      return getPlaybackSnapshot().isMuted;
    },
    error,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    // o YouTube decide a qualidade sozinho — não há nível para nós limitarmos
    resolution: null,
    fpsLimit: "auto",
  };

  return { isReady, error, controller };
}
