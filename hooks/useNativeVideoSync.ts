"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import Hls from "hls.js";
import { isHlsUrl } from "@/lib/video-source";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import {
  expectedPlaybackTime,
  DRIFT_THRESHOLD_NATIVE_S,
  CHECK_INTERVAL_MS,
  REMOTE_APPLY_COOLDOWN_MS,
  type PlaybackController,
} from "@/hooks/playerController";
import { parsePlayerEvent, shouldApplyPlayerEvent } from "@/lib/playback/events";
import { skewFor, updateSkew, type SkewSamples } from "@/lib/playback/clock";
import type { FpsLimit, Resolution } from "@/lib/playback/types";

// Mesmo esqueleto de useYouTubeSync/useVimeoSync (constantes de drift/cooldown,
// applyRemote, commitPlayer/broadcast, destruir+zerar ref na troca de fonte,
// loadedAt nas deps pra forçar reload em retry — ver docs/specs/01-fundacao-mvp/spec.md, seção 7) aplicado
// a mídia direta (.mp4/.webm) e HLS (.m3u8) via <video> nativo + hls.js.
export function useNativeVideoSync({
  containerId,
  userId,
  targetResolution = "720p",
  fpsLimit = "auto",
}: {
  containerId: string;
  userId: string;
  targetResolution?: Resolution;
  fpsLimit?: FpsLimit;
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
  const targetResolutionRef = useRef(targetResolution);
  const fpsLimitRef = useRef(fpsLimit);
  // desvio de relógio estimado por ator e maior `ts` já aplicado (last-write-wins)
  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);

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

  // Manter refs atualizados com os valores atuais para usar dentro dos
  // handlers do hls.js sem recriar a instância.
  useEffect(() => { targetResolutionRef.current = targetResolution; }, [targetResolution]);
  useEffect(() => { fpsLimitRef.current = fpsLimit; }, [fpsLimit]);

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
    // idêntica (retry) — sem isso, recarregar o mesmo link é no-op. Mas esse
    // atalho só é seguro quando o load anterior tinha dado certo: `src` fica
    // truthy mesmo depois de um manifest HLS 404 ou de um mp4 que nunca
    // carregou (achado 2 do code review), então sem checar `isReady && !error`
    // o "tentar carregar de novo" clicava em play() num elemento sem fonte
    // válida — mensagem de erro sumia, tela ficava preta, nada era rebuscado.
    if (loadedUrlRef.current === url && videoEl.src && isReady && !error) {
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
      // teto de resolução (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.4) — autoLevelCapping mantém o ABR
      // vivo abaixo do limite, ao contrário de currentLevel/loadLevel (que
      // fixam o nível e cortam a capacidade de cair de qualidade em rede
      // ruim). Registrado antes de loadSource: MANIFEST_PARSED dispara antes
      // da escolha do primeiro fragmento, então o teto já vale de cara.
      const heightForTarget = (t: Resolution) => (t === "480p" ? 480 : 720);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const maxHeight = heightForTarget(targetResolutionRef.current);
        const cap = hls.levels.reduce(
          (best, lvl, i) =>
            lvl.height <= maxHeight && (best < 0 || lvl.height > hls.levels[best].height) ? i : best,
          -1,
        );
        hls.autoLevelCapping = cap;
        if (fpsLimitRef.current === "30") {
          // RISCO: maxMaxBufferLength é propriedade interna do config do hls.js, não API pública.
          // Funciona em hls.js 1.7.x (o config é objeto mutável lido pelo stream controller a
          // cada ciclo), mas pode quebrar em updates. Monitorar mudanças em:
          // https://github.com/video-dev/hls.js/blob/master/src/config.ts
          // Fallback: se removida, a limitação de FPS via buffer deixa de funcionar (sem impacto
          // na resolução ou no ABR — apenas mais frames processados).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (hls.config as any).maxMaxBufferLength = 2;
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
    // `isReady`/`error` são lidos só pra decidir o atalho de retry acima, com
    // o valor de antes deste load começar — de propósito fora das deps: se
    // entrassem, o efeito rodaria de novo quando `isReady` vira `true` no
    // load bem-sucedido, caindo no próprio atalho e reiniciando o vídeo do
    // zero (currentTime = 0) logo depois de carregar normalmente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const { time, shouldPlay } = expectedPlaybackTime(
          snapshot,
          videoEl.duration || 0,
          skewFor(skewRef.current, snapshot.lastActorId),
        );
        applyRemote(() => {
          videoEl.currentTime = time;
          if (shouldPlay) videoEl.play().catch(() => {});
          else videoEl.pause();
        });
        setIsPlayingLocal(shouldPlay);
      }
    };

    const onPlay = () => {
      setIsPlayingLocal(true);
      setError(null);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "PLAY",
        time: videoEl.currentTime,
        source: "DIRECT_MEDIA",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
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
        source: "DIRECT_MEDIA",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
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
        source: "DIRECT_MEDIA",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
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

  // Recalcular cap de resolução quando targetResolution muda em runtime
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !hls.levels.length) return;

    const maxHeight = targetResolution === "480p" ? 480 : 720;
    const cap = hls.levels.reduce(
      (best, lvl, i) =>
        lvl.height <= maxHeight && (best < 0 || lvl.height > hls.levels[best].height) ? i : best,
      -1,
    );
    hls.autoLevelCapping = cap;
    if (hls.currentLevel > cap) {
      hls.currentLevel = cap;
    }
  }, [targetResolution]);

  // FPS limit: reduzir buffer quando limitado a 30fps — maxMaxBufferLength
  // é config interno do hls.js (não exposto como setter público), mas o objeto
  // config é mutável em runtime e o stream controller lê dele a cada ciclo.
  // RISCO: maxMaxBufferLength é propriedade interna do config do hls.js, não API pública.
  // Funciona em hls.js 1.7.x (o config é objeto mutável lido pelo stream controller a
  // cada ciclo), mas pode quebrar em updates. Monitorar mudanças em:
  // https://github.com/video-dev/hls.js/blob/master/src/config.ts
  // Fallback: se removida, a limitação de FPS via buffer deixa de funcionar (sem impacto
  // na resolução ou no ABR — apenas mais frames processados).
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = hls.config as any;
    if (fpsLimit === "30") {
      cfg.maxMaxBufferLength = 2;
    } else {
      cfg.maxMaxBufferLength = undefined;
    }
  }, [fpsLimit]);

  useEventListener(({ event }) => {
    // O payload chega de outro cliente e vira `currentTime` direto: passa por
    // validação de formato antes de qualquer coisa (lib/playback/events).
    const parsed = parsePlayerEvent(event);
    if (!parsed) return;

    // Alimenta a estimativa de desvio de relógio com o `ts` do remetente.
    skewRef.current = updateSkew(skewRef.current, parsed.actorId, parsed.ts, Date.now());

    const videoEl = videoElRef.current;
    if (!videoEl) return;

    if (
      !shouldApplyPlayerEvent(parsed, {
        selfId: userId,
        localSource: "DIRECT_MEDIA",
        lastAppliedTs: lastAppliedTsRef.current,
      })
    ) {
      return;
    }
    lastAppliedTsRef.current = parsed.ts;

    applyRemote(() => {
      if (parsed.type === "PLAY") {
        videoEl.currentTime = parsed.time;
        videoEl.play().catch(() => {});
      } else if (parsed.type === "PAUSE") {
        videoEl.currentTime = parsed.time;
        videoEl.pause();
      } else if (parsed.type === "SEEK") {
        videoEl.currentTime = parsed.time;
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

      const { time: expected, stale } = expectedPlaybackTime(
        snapshot,
        videoEl.duration || 0,
        skewFor(skewRef.current, snapshot.lastActorId),
      );
      if (stale) return; // snapshot abandonado: não arrasta ninguém
      if (Math.abs(videoEl.currentTime - expected) > DRIFT_THRESHOLD_NATIVE_S) {
        applyRemote(() => {
          videoEl.currentTime = expected;
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isReady, userId, applyRemote]);

  // Rejeitar a promise de play() por `AbortError` é o comportamento normal
  // quando outra chamada (pause()/mudar currentTime) interrompe um play()
  // ainda pendente — acontece o tempo todo com sync remoto (PAUSE de outro
  // participante, correção de drift a cada 3s) e não é falha de playback:
  // reportar como erro real deixava o overlay preso pra sempre por cima de
  // um vídeo que continuava tocando normalmente (achado 1 do code review,
  // regressão da correção que fez o overlay parar de sumir sozinho).
  const reportPlayFailure = useCallback((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
    setError("não foi possível iniciar a reprodução. tente de novo.");
  }, []);

  // play() pode ser rejeitado (política de autoplay do browser, mídia ainda
  // não pronta) — sem tratar isso o clique em play parece não fazer nada,
  // sem nenhum feedback (mesma classe de falha silenciosa da seção 7).
  const play = useCallback(() => {
    videoElRef.current?.play().catch(reportPlayFailure);
  }, [reportPlayFailure]);
  const pause = useCallback(() => {
    videoElRef.current?.pause();
  }, []);
  const togglePlay = useCallback(() => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(reportPlayFailure);
    } else {
      videoEl.pause();
    }
  }, [reportPlayFailure]);
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

  // O teto de resolução só existe quando NÓS controlamos o ABR (hls.js). Em
  // `.mp4`/`.webm`, ou em HLS nativo do Safari, não há nível para limitar — e o
  // botão tem que sair desabilitado com o motivo certo, em vez de habilitado e
  // inerte. A versão anterior gateava por `Hls.isSupported()` (capacidade do
  // navegador), então um `.mp4` no Chrome anunciava suporte a resolução.
  const canCapResolution = isHlsUrl(video?.embedUrl ?? "") && Hls.isSupported();

  const controller: PlaybackController = {
    isReady,
    isPlaying: isPlayingLocal,
    currentTime,
    duration,
    volume,
    isMuted: isMutedLocal,
    error,
    resolution: canCapResolution ? targetResolution : null,
    fpsLimit,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  };

  return { isReady, error, controller };
}
