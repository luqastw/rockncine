"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import { loadYouTubeIframeApi } from "@/lib/youtube-iframe";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import {
  expectedPlaybackTime,
  DRIFT_THRESHOLD_YOUTUBE_S,
  CHECK_INTERVAL_MS,
  SEEK_WHILE_PAUSED_THRESHOLD_S,
  REMOTE_APPLY_COOLDOWN_MS,
  type PlaybackController,
} from "@/hooks/playerController";

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
}: {
  containerId: string;
  userId: string;
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

  // estado local só pra UI da barra de controles — não participa do sync
  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeLocal] = useState(1);
  const [isMutedLocal, setIsMutedLocal] = useState(false);

  // YouTube IFrame API não retorna Promise — timeout de fallback (1500ms)
  // garante que o flag não fica preso se onStateChange não disparar (spec 08, CA1.2).
  const applyRemote = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, REMOTE_APPLY_COOLDOWN_MS);
  }, []);

  // unloadModule sozinho não é suficiente: a API pode recarregar o módulo
  // "captions" com uma faixa auto-selecionada (ASR, pelo idioma do
  // navegador) depois do unload, sem disparar `onApiChange` de novo —
  // confirmado via `getOption('captions', 'track')` no console mostrando
  // uma faixa ativa mesmo após o unload (achado pós-deploy, 14.7). Limpar a
  // faixa explicitamente com `setOption('captions', 'track', {})` é o que
  // de fato zera a exibição.
  const disableCaptions = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
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
            disableCaptions();
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
              disableCaptions();
              window.setTimeout(disableCaptions, 500);
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
              disableCaptions();
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              setIsPlayingLocal(false);
            }

            if (isApplyingRemoteRef.current) return;
            const player = playerRef.current;
            if (!player) return;

            if (e.data === window.YT.PlayerState.PLAYING) {
              const time = player.getCurrentTime();
              const evt: PlayerEvent = { type: "PLAY", time, actorId: userId, ts: Date.now() };
              commitPlayer({
                isPlaying: true,
                currentTime: time,
                updatedAt: evt.ts,
                lastActorId: userId,
              });
              broadcast(evt);
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              const time = player.getCurrentTime();
              const evt: PlayerEvent = { type: "PAUSE", time, actorId: userId, ts: Date.now() };
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

  // aplica PLAY/PAUSE/SEEK vindos de outros participantes
  useEventListener(({ event }) => {
    if (event.type !== "PLAY" && event.type !== "PAUSE" && event.type !== "SEEK") return;
    if (event.actorId === userId) return; // origem já aplicou localmente

    const player = playerRef.current;
    if (!player) return;

    applyRemote(() => {
      if (event.type === "PLAY") {
        player.seekTo(event.time, true);
        player.playVideo();
        setIsPlayingLocal(true);
      } else if (event.type === "PAUSE") {
        player.seekTo(event.time, true);
        player.pauseVideo();
        setIsPlayingLocal(false);
      } else if (event.type === "SEEK") {
        player.seekTo(event.time, true);
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
  }, [isReady]);

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

      const { time: expected, stale } = expectedPlaybackTime(snapshot, duration);
      if (stale) return; // snapshot abandonado: não arrasta ninguém (ver playerController)
      const diff = localTime - expected;
      const isOwner = snapshot.lastActorId === userId;
      const isPaused = player.getPlayerState() === window.YT.PlayerState.PAUSED;

      if (isOwner && isPaused && Math.abs(diff) > SEEK_WHILE_PAUSED_THRESHOLD_S) {
        const evt: PlayerEvent = { type: "SEEK", time: localTime, actorId: userId, ts: Date.now() };
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
  }, [isReady, userId, duration, commitPlayer, broadcast, applyRemote]);

  // controles imperativos — chamados pela nossa própria barra (chrome nativo
  // do YouTube fica escondido via controls:0/disablekb:1). Os listeners acima
  // (onStateChange) já cuidam de commit+broadcast quando o estado muda de
  // fato; aqui só disparamos a ação no player, exceto seek(), que precisa de
  // broadcast explícito próprio — a API do YouTube não emite evento de seek.
  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const togglePlay = useCallback(() => {
    if (isPlayingLocal) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  }, [isPlayingLocal]);

  const seek = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      player.seekTo(seconds, true);
      setCurrentTime(seconds);
      const evt: PlayerEvent = { type: "SEEK", time: seconds, actorId: userId, ts: Date.now() };
      commitPlayer({
        isPlaying: player.getPlayerState() === window.YT.PlayerState.PLAYING,
        currentTime: seconds,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    },
    [userId, commitPlayer, broadcast],
  );

  const setVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(Math.round(v * 100));
    setVolumeLocal(v);
    if (v > 0) {
      playerRef.current?.unMute();
      setIsMutedLocal(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isMutedLocal) {
      player.unMute();
      setIsMutedLocal(false);
    } else {
      player.mute();
      setIsMutedLocal(true);
    }
  }, [isMutedLocal]);

  const controller: PlaybackController = {
    isReady,
    isPlaying: isPlayingLocal,
    currentTime,
    duration,
    volume,
    isMuted: isMutedLocal,
    error,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  };

  return { isReady, error, controller };
}
