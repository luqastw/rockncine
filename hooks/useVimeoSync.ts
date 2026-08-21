"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import Player from "@vimeo/player";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import { expectedPlaybackTime, type PlaybackController } from "@/hooks/playerController";

const DRIFT_THRESHOLD_S = 1.5;
const CHECK_INTERVAL_MS = 3000;
const MAX_QUALITY_HEIGHT = 720;

// Reforço best-effort do teto de 720p além da opção de embed do construtor
// (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.4) — não está garantido que max_quality sobrevive a um
// loadVideo(), então reaplica aqui. Silencioso de propósito: rejeitar é o
// caso comum em vídeo de conta free, não um erro real pro usuário.
function capQuality(player: Player) {
  player
    .getQualities()
    .then((qualities) => {
      const capped = qualities
        .filter((q) => {
          const height = Number.parseInt(q.id, 10);
          return Number.isFinite(height) ? height <= MAX_QUALITY_HEIGHT : q.id !== "auto";
        })
        .sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10))[0];
      if (capped) return player.setQuality(capped.id);
    })
    .catch(() => {});
}

// Vimeo Player SDK expõe eventos nativos de play/pause/seeked — ao contrário do
// YouTube, não precisa de heurística de BUFFERING pra detectar seek manual.
export function useVimeoSync({ containerId, userId }: { containerId: string; userId: string }) {
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

  const playerRef = useRef<Player | null>(null);
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

  // API do Vimeo é baseada em Promise — o cooldown termina quando a promise
  // resolve, não num timeout fixo (evita reabrir a janela cedo demais).
  const applyRemote = useCallback((fn: () => unknown) => {
    isApplyingRemoteRef.current = true;
    const result = fn();
    const clear = () => {
      isApplyingRemoteRef.current = false;
    };
    if (result && typeof (result as Promise<unknown>).then === "function") {
      (result as Promise<unknown>).then(clear, clear);
    } else {
      window.setTimeout(clear, 400);
    }
  }, []);

  useEffect(() => {
    if (!video?.embedUrl || video.source !== "VIMEO") {
      // saiu do Vimeo pra outra fonte: o container #vimeo-player é desmontado
      // pelo RoomExperience — destrói a ref presa agora, senão um load futuro
      // de Vimeo reusa esse player morto em vez de criar um novo contra o
      // container recém-montado.
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

    if (playerRef.current) {
      // loadedAt muda a cada "carregar" mesmo pra URL idêntica — sem
      // depender só de loadedVideoIdRef, recarregar o mesmo link virava
      // no-op silencioso.
      setError(null);
      applyRemote(() =>
        playerRef.current!.loadVideo(videoId).then(
          () => {
            setError(null);
            capQuality(playerRef.current!);
          },
          (err) => setError(err?.message || "não foi possível reproduzir este vídeo."),
        ),
      );
      loadedVideoIdRef.current = videoId;
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    const player = new Player(container, {
      id: videoId,
      controls: false,
      // teto de 720p (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.4) — best-effort: o gate real é o
      // plano de quem subiu o vídeo, não o nosso. Não é contrato garantido.
      max_quality: "720p",
    });
    playerRef.current = player;

    player.on("error", (data) => {
      setError(data.message || "não foi possível reproduzir este vídeo.");
    });

    player.ready().then(() => {
      if (cancelled) return;
      loadedVideoIdRef.current = videoId;
      setIsReady(true);
      player.getDuration().then(setDuration);
      player.getVolume().then(setVolumeLocal);
      player.getMuted().then(setIsMutedLocal);
      capQuality(player);

      const snapshot = playerStorageRef.current;
      if (snapshot) {
        player.getDuration().then((total) => {
          const { time, shouldPlay } = expectedPlaybackTime(snapshot, total || 0);
          applyRemote(async () => {
            await player.setCurrentTime(time);
            if (shouldPlay) await player.play();
            else await player.pause();
          });
          setIsPlayingLocal(shouldPlay);
        });
      }
    });

    player.on("timeupdate", (data: { seconds: number; duration: number }) => {
      setCurrentTime(data.seconds);
      if (data.duration) setDuration(data.duration);
    });

    player.on("play", (data) => {
      setIsPlayingLocal(true);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = { type: "PLAY", time: data.seconds, actorId: userId, ts: Date.now() };
      commitPlayer({ isPlaying: true, currentTime: data.seconds, updatedAt: evt.ts, lastActorId: userId });
      broadcast(evt);
    });

    player.on("pause", (data) => {
      setIsPlayingLocal(false);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = { type: "PAUSE", time: data.seconds, actorId: userId, ts: Date.now() };
      commitPlayer({ isPlaying: false, currentTime: data.seconds, updatedAt: evt.ts, lastActorId: userId });
      broadcast(evt);
    });

    player.on("seeked", (data) => {
      if (isApplyingRemoteRef.current) return;
      const base = playerStorageRef.current;
      const evt: PlayerEvent = { type: "SEEK", time: data.seconds, actorId: userId, ts: Date.now() };
      commitPlayer({
        isPlaying: base?.isPlaying ?? false,
        currentTime: data.seconds,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
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

  useEventListener(({ event }) => {
    if (event.type !== "PLAY" && event.type !== "PAUSE" && event.type !== "SEEK") return;
    if (event.actorId === userId) return;

    const player = playerRef.current;
    if (!player) return;

    if (event.type === "PLAY") {
      applyRemote(async () => {
        await player.setCurrentTime(event.time);
        await player.play();
        setIsPlayingLocal(true);
      });
    } else if (event.type === "PAUSE") {
      applyRemote(async () => {
        await player.setCurrentTime(event.time);
        await player.pause();
        setIsPlayingLocal(false);
      });
    } else if (event.type === "SEEK") {
      applyRemote(() => player.setCurrentTime(event.time));
      setCurrentTime(event.time);
    }
  });

  // drift correction — só pra quem não é o dono da última ação (o dono já
  // está coberto pelos eventos nativos play/pause/seeked acima).
  useEffect(() => {
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      const snapshot = playerStorageRef.current;
      if (!player || !snapshot || !isReady) return;
      if (isApplyingRemoteRef.current) return;
      if (snapshot.lastActorId === userId) return;

      player.getCurrentTime().then((localTime) => {
        const { time: expected, stale } = expectedPlaybackTime(snapshot, duration);
        if (stale) return; // snapshot abandonado: não arrasta ninguém
        if (Math.abs(localTime - expected) > DRIFT_THRESHOLD_S) {
          applyRemote(() => player.setCurrentTime(expected));
        }
      });
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isReady, userId, duration, applyRemote]);

  // controles imperativos — chamados pela nossa própria barra (chrome nativo
  // do Vimeo fica escondido via controls:false). Os listeners 'play'/'pause'
  // já cuidam de commit+broadcast; seek() aqui dispara commit+broadcast
  // explícito porque um seek isolado durante playback não passa por
  // 'play'/'pause'.
  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);
  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);
  const togglePlay = useCallback(() => {
    if (isPlayingLocal) playerRef.current?.pause();
    else playerRef.current?.play();
  }, [isPlayingLocal]);

  const seek = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player) return;
      // `setCurrentTime` envolto em `applyRemote`: sem isso o listener
      // 'seeked' (acima) via `isApplyingRemoteRef.current === false` num seek
      // que na verdade era local, e mandava um segundo commit+broadcast
      // idêntico pra cada arraste do scrubber (achado 3 do code review —
      // duplicava o evento pra todo participante e o flash do SyncRing
      // piscava duas vezes).
      applyRemote(() => player.setCurrentTime(seconds));
      setCurrentTime(seconds);
      const evt: PlayerEvent = { type: "SEEK", time: seconds, actorId: userId, ts: Date.now() };
      commitPlayer({
        isPlaying: isPlayingLocal,
        currentTime: seconds,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    },
    [userId, commitPlayer, broadcast, isPlayingLocal, applyRemote],
  );

  const setVolume = useCallback((v: number) => {
    playerRef.current?.setVolume(v);
    setVolumeLocal(v);
    if (v > 0) {
      playerRef.current?.setMuted(false);
      setIsMutedLocal(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const next = !isMutedLocal;
    player.setMuted(next);
    setIsMutedLocal(next);
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
