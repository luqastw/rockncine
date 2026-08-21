"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import Hls from "hls.js";
import { isHlsUrl } from "@/lib/video-source";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import type { PlaybackController } from "@/hooks/playerController";

const DRIFT_THRESHOLD_S = 1.5;
const CHECK_INTERVAL_MS = 3000;
const REMOTE_APPLY_COOLDOWN_MS = 400;

// Mesmo esqueleto de useYouTubeSync/useVimeoSync (constantes de drift/cooldown,
// applyRemote, commitPlayer/broadcast, destruir+zerar ref na troca de fonte,
// loadedAt nas deps pra forçar reload em retry — ver SPEC.md seção 7) aplicado
// a mídia direta (.mp4/.webm) e HLS (.m3u8) via <video> nativo + hls.js.
export function useNativeVideoSync({
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

  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const loadedUrlRef = useRef<string | null>(null);

  const [isPlayingLocal, setIsPlayingLocal] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeLocal] = useState(1);
  const [isMutedLocal, setIsMutedLocal] = useState(false);

  const applyRemote = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, REMOTE_APPLY_COOLDOWN_MS);
  }, []);

  useEffect(() => {
    if (!video?.embedUrl || video.source !== "DIRECT_MEDIA") {
      // saiu da mídia direta pra outra fonte: o container <video> é
      // desmontado pelo RoomExperience — derruba hls.js e zera a ref, senão
      // um load futuro reusa referências mortas contra um elemento novo.
      if (videoElRef.current || hlsRef.current) {
        hlsRef.current?.destroy();
        hlsRef.current = null;
        videoElRef.current = null;
        loadedUrlRef.current = null;
        setIsReady(false);
      }
      return;
    }

    const url = video.embedUrl;
    let cancelled = false;

    const videoEl = document.getElementById(containerId) as HTMLVideoElement | null;
    if (!videoEl) return;
    videoElRef.current = videoEl;

    // loadedAt nas deps força este efeito a rodar de novo mesmo pra URL
    // idêntica (retry) — sem isso, recarregar o mesmo link é no-op.
    if (loadedUrlRef.current === url && videoEl.src) {
      setError(null);
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
      return;
    }

    setError(null);
    setIsReady(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(url) && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (cancelled) return;
        if (data.fatal) {
          setError("falha ao carregar o stream (manifest/rede). tente carregar de novo.");
        }
      });
      hls.loadSource(url);
      hls.attachMedia(videoEl);
    } else {
      // Safari suporta HLS nativo via video.src direto, sem hls.js; mp4/webm
      // puro também vai direto.
      videoEl.src = url;
    }

    loadedUrlRef.current = url;

    return () => {
      cancelled = true;
    };
  }, [video?.embedUrl, video?.source, video?.loadedAt, containerId]);

  // eventos nativos de <video> — play/pause/seeked/timeupdate/durationchange/error
  useEffect(() => {
    const videoEl = videoElRef.current;
    if (!videoEl) return undefined;

    const onLoadedMetadata = () => {
      setIsReady(true);
      setDuration(videoEl.duration || 0);
      setVolumeLocal(videoEl.volume);
      setIsMutedLocal(videoEl.muted);

      const snapshot = playerStorageRef.current;
      if (snapshot) {
        const expected =
          snapshot.currentTime +
          (snapshot.isPlaying ? (Date.now() - snapshot.updatedAt) / 1000 : 0);
        applyRemote(() => {
          videoEl.currentTime = Math.max(expected, 0);
          if (snapshot.isPlaying) videoEl.play().catch(() => {});
          else videoEl.pause();
        });
        setIsPlayingLocal(snapshot.isPlaying);
      }
    };

    const onPlay = () => {
      setIsPlayingLocal(true);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "PLAY",
        time: videoEl.currentTime,
        actorId: userId,
        ts: Date.now(),
      };
      commitPlayer({
        isPlaying: true,
        currentTime: videoEl.currentTime,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    };

    const onPause = () => {
      setIsPlayingLocal(false);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "PAUSE",
        time: videoEl.currentTime,
        actorId: userId,
        ts: Date.now(),
      };
      commitPlayer({
        isPlaying: false,
        currentTime: videoEl.currentTime,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    };

    const onSeeked = () => {
      setCurrentTime(videoEl.currentTime);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "SEEK",
        time: videoEl.currentTime,
        actorId: userId,
        ts: Date.now(),
      };
      commitPlayer({
        isPlaying: !videoEl.paused,
        currentTime: videoEl.currentTime,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    };

    const onTimeUpdate = () => setCurrentTime(videoEl.currentTime);
    const onDurationChange = () => setDuration(videoEl.duration || 0);
    const onError = () => setError("não foi possível reproduzir este vídeo.");
    const onVolumeChange = () => {
      setVolumeLocal(videoEl.volume);
      setIsMutedLocal(videoEl.muted);
    };

    videoEl.addEventListener("loadedmetadata", onLoadedMetadata);
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.addEventListener("durationchange", onDurationChange);
    videoEl.addEventListener("error", onError);
    videoEl.addEventListener("volumechange", onVolumeChange);

    return () => {
      videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("seeked", onSeeked);
      videoEl.removeEventListener("timeupdate", onTimeUpdate);
      videoEl.removeEventListener("durationchange", onDurationChange);
      videoEl.removeEventListener("error", onError);
      videoEl.removeEventListener("volumechange", onVolumeChange);
    };
  }, [video?.embedUrl, video?.loadedAt, userId, commitPlayer, broadcast, applyRemote]);

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  useEventListener(({ event }) => {
    if (event.type !== "PLAY" && event.type !== "PAUSE" && event.type !== "SEEK") return;
    if (event.actorId === userId) return;

    const videoEl = videoElRef.current;
    if (!videoEl) return;

    applyRemote(() => {
      if (event.type === "PLAY") {
        videoEl.currentTime = event.time;
        videoEl.play().catch(() => {});
      } else if (event.type === "PAUSE") {
        videoEl.currentTime = event.time;
        videoEl.pause();
      } else if (event.type === "SEEK") {
        videoEl.currentTime = event.time;
      }
    });
  });

  // drift correction — só pra quem não é o dono da última ação
  useEffect(() => {
    const interval = window.setInterval(() => {
      const videoEl = videoElRef.current;
      const snapshot = playerStorageRef.current;
      if (!videoEl || !snapshot || !isReady) return;
      if (isApplyingRemoteRef.current) return;
      if (snapshot.lastActorId === userId) return;

      const expected =
        snapshot.currentTime +
        (snapshot.isPlaying ? (Date.now() - snapshot.updatedAt) / 1000 : 0);
      if (Math.abs(videoEl.currentTime - expected) > DRIFT_THRESHOLD_S) {
        applyRemote(() => {
          videoEl.currentTime = Math.max(expected, 0);
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isReady, userId, applyRemote]);

  // play() pode ser rejeitado (política de autoplay do browser, mídia ainda
  // não pronta) — sem tratar isso o clique em play parece não fazer nada,
  // sem nenhum feedback (mesma classe de falha silenciosa da seção 7).
  const play = useCallback(() => {
    videoElRef.current
      ?.play()
      .catch(() => setError("não foi possível iniciar a reprodução. tente de novo."));
  }, []);
  const pause = useCallback(() => {
    videoElRef.current?.pause();
  }, []);
  const togglePlay = useCallback(() => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl
        .play()
        .catch(() => setError("não foi possível iniciar a reprodução. tente de novo."));
    } else {
      videoEl.pause();
    }
  }, []);
  const seek = useCallback((seconds: number) => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    videoEl.currentTime = seconds;
    // onSeeked cuida do commit+broadcast
  }, []);
  const setVolume = useCallback((v: number) => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    videoEl.volume = v;
    if (v > 0) videoEl.muted = false;
  }, []);
  const toggleMute = useCallback(() => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    videoEl.muted = !videoEl.muted;
  }, []);

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
