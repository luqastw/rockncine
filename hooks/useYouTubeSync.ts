"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import { loadYouTubeIframeApi } from "@/lib/youtube-iframe";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";

const DRIFT_THRESHOLD_S = 1.5;
const CHECK_INTERVAL_MS = 3000;
const SEEK_WHILE_PAUSED_THRESHOLD_S = 2;
const REMOTE_APPLY_COOLDOWN_MS = 400;

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

  const applyRemote = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, REMOTE_APPLY_COOLDOWN_MS);
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
        return;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            loadedVideoIdRef.current = videoId;
            setIsReady(true);

            // late join: aplica o snapshot atual do storage em vez de esperar broadcast
            const snapshot = playerStorageRef.current;
            if (snapshot) {
              const expected =
                snapshot.currentTime +
                (snapshot.isPlaying ? (Date.now() - snapshot.updatedAt) / 1000 : 0);
              applyRemote(() => {
                playerRef.current!.seekTo(Math.max(expected, 0), true);
                if (snapshot.isPlaying) playerRef.current!.playVideo();
                else playerRef.current!.pauseVideo();
              });
            }
          },
          onError: (e) => {
            setError(youtubeErrorMessage(e.data));
          },
          onStateChange: (e) => {
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
    if (event.type === "CHAT_MESSAGE" || event.type === "LOAD_VIDEO") return;
    if (event.actorId === userId) return; // origem já aplicou localmente

    const player = playerRef.current;
    if (!player) return;

    applyRemote(() => {
      if (event.type === "PLAY") {
        player.seekTo(event.time, true);
        player.playVideo();
      } else if (event.type === "PAUSE") {
        player.seekTo(event.time, true);
        player.pauseVideo();
      } else if (event.type === "SEEK") {
        player.seekTo(event.time, true);
      }
    });
  });

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

      const expected =
        snapshot.currentTime +
        (snapshot.isPlaying ? (Date.now() - snapshot.updatedAt) / 1000 : 0);
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

      if (!isOwner && Math.abs(diff) > DRIFT_THRESHOLD_S) {
        applyRemote(() => player.seekTo(Math.max(expected, 0), true));
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isReady, userId, commitPlayer, broadcast, applyRemote]);

  return { isReady, error };
}
