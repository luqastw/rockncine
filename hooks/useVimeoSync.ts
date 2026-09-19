"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import Player from "@vimeo/player";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import {
  expectedPlaybackTime,
  DRIFT_THRESHOLD_NATIVE_S,
  CHECK_INTERVAL_MS,
  type PlaybackController,
} from "@/hooks/playerController";
import { parsePlayerEvent, shouldApplyPlayerEvent } from "@/lib/playback/events";
import { skewFor, updateSkew, type SkewSamples } from "@/lib/playback/clock";
import type { Resolution } from "@/lib/playback/types";

const RESOLUTION_MAX_HEIGHT: Record<Resolution, number> = {
  "720p": 720,
  "480p": 480,
};

// O SDK do Vimeo devolve mensagens em inglês ("Sorry, this video does not
// exist"), que apareciam cruas dentro de uma UI em português. O YouTube já
// tinha mapa equivalente (youtubeErrorMessage); o Vimeo não tinha nenhum.
function vimeoErrorMessage(raw: unknown): string {
  const message = typeof raw === "string" ? raw : "";
  if (/password/i.test(message)) return "este vídeo é privado e exige senha.";
  if (/does not exist|not found|404/i.test(message)) return "vídeo não encontrado ou privado.";
  if (/privacy|embed|permission|domain/i.test(message)) {
    return "o dono deste vídeo não permite reprodução embutida.";
  }
  return "não foi possível reproduzir este vídeo.";
}

// Reforço best-effort do teto de resolução além da opção de embed do construtor
// (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.4) — não está garantido que max_quality sobrevive a um
// loadVideo(), então reaplica aqui. Silencioso de propósito: rejeitar é o
// caso comum em vídeo de conta free, não um erro real pro usuário.
function capQuality(player: Player, resolution: Resolution = "720p") {
  const maxHeight = RESOLUTION_MAX_HEIGHT[resolution];
  player
    .getQualities()
    .then((qualities) => {
      const capped = qualities
        .filter((q) => {
          const height = Number.parseInt(q.id, 10);
          return Number.isFinite(height) ? height <= maxHeight : q.id !== "auto";
        })
        .sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10))[0];
      if (capped) return player.setQuality(capped.id);
    })
    .catch(() => {});
}

// Vimeo Player SDK expõe eventos nativos de play/pause/seeked — ao contrário do
// YouTube, não precisa de heurística de BUFFERING pra detectar seek manual.
export function useVimeoSync({
  containerId,
  userId,
  targetResolution = "720p",
}: {
  containerId: string;
  userId: string;
  targetResolution?: Resolution;
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

  const playerRef = useRef<Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  // desvio de relógio estimado por ator e maior `ts` já aplicado (last-write-wins)
  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);
  // A resolução é aplicada por efeitos próprios; mantê-la fora das deps do
  // efeito de criação abaixo é o que impede alternar 720p/480p de RECARREGAR o
  // vídeo (e de deixar `isReady` preso em false no meio do caminho).
  const targetResolutionRef = useRef(targetResolution);

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
    targetResolutionRef.current = targetResolution;
  }, [targetResolution]);

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

    // posição da sala no momento em que o player fica pronto. Compartilhado
    // entre o primeiro load e o reload, porque os dois precisam terminar no
    // mesmo lugar — antes só o primeiro aplicava o snapshot, e um reload
    // deixava a sala tocando do zero.
    const applySnapshot = (target: Player) => {
      const snapshot = playerStorageRef.current;
      if (!snapshot) return;
      target.getDuration().then((total) => {
        const { time, shouldPlay } = expectedPlaybackTime(
          snapshot,
          total || 0,
          skewFor(skewRef.current, snapshot.lastActorId),
        );
        applyRemote(async () => {
          await target.setCurrentTime(time);
          if (shouldPlay) await target.play();
          else await target.pause();
        });
        setIsPlayingLocal(shouldPlay);
      });
    };

    if (playerRef.current) {
      // loadedAt muda a cada "carregar" mesmo pra URL idêntica — sem
      // depender só de loadedVideoIdRef, recarregar o mesmo link virava
      // no-op silencioso.
      //
      // O `setIsReady(true)` e o reaplicar do snapshot aqui não são
      // decoração: sem eles, um reload que interrompesse o `ready()` do load
      // inicial (o cleanup marca `cancelled`, e o handler do ready desiste no
      // `if (cancelled) return`) deixava `isReady` preso em `false` para
      // sempre — a sala ficava em "carregando player..." até recarregar a
      // página.
      setError(null);
      applyRemote(() =>
        playerRef.current!.loadVideo(videoId).then(
          () => {
            if (cancelled) return;
            setError(null);
            setIsReady(true);
            capQuality(playerRef.current!, targetResolutionRef.current);
            applySnapshot(playerRef.current!);
          },
          (err) => setError(vimeoErrorMessage(err?.message)),
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
      setError(vimeoErrorMessage(data.message));
    });

    player.ready().then(() => {
      if (cancelled) return;
      loadedVideoIdRef.current = videoId;
      setIsReady(true);
      player.getDuration().then(setDuration);
      player.getVolume().then(setVolumeLocal);
      player.getMuted().then(setIsMutedLocal);
      capQuality(player, targetResolutionRef.current);
      applySnapshot(player);
    });

    player.on("timeupdate", (data: { seconds: number; duration: number }) => {
      setCurrentTime(data.seconds);
      if (data.duration) setDuration(data.duration);
    });

    player.on("play", (data) => {
      setIsPlayingLocal(true);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "PLAY",
        time: data.seconds,
        source: "VIMEO",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
      commitPlayer({ isPlaying: true, currentTime: data.seconds, updatedAt: evt.ts, lastActorId: userId });
      broadcast(evt);
    });

    player.on("pause", (data) => {
      setIsPlayingLocal(false);
      if (isApplyingRemoteRef.current) return;
      const evt: PlayerEvent = {
        type: "PAUSE",
        time: data.seconds,
        source: "VIMEO",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
      commitPlayer({ isPlaying: false, currentTime: data.seconds, updatedAt: evt.ts, lastActorId: userId });
      broadcast(evt);
    });

    player.on("seeked", (data) => {
      if (isApplyingRemoteRef.current) return;
      const base = playerStorageRef.current;
      const evt: PlayerEvent = {
        type: "SEEK",
        time: data.seconds,
        source: "VIMEO",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
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
    // `targetResolution` fora das deps DE PROPÓSITO: com ela aqui, alternar
    // resolução (botão dos controles ou modo economy) reexecutava este efeito,
    // e o ramo de reload acima recarregava o vídeo do zero no meio da sessão
    // de todo mundo. O valor corrente é lido de `targetResolutionRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.embedUrl, video?.source, video?.loadedAt, containerId, userId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      capQuality(playerRef.current, targetResolution);
    }
  }, [targetResolution]);

  useEventListener(({ event }) => {
    // O payload chega de outro cliente e vira `setCurrentTime` direto: passa
    // por validação de formato antes de qualquer coisa (lib/playback/events).
    const parsed = parsePlayerEvent(event);
    if (!parsed) return;

    // Alimenta a estimativa de desvio de relógio com o `ts` do remetente.
    skewRef.current = updateSkew(skewRef.current, parsed.actorId, parsed.ts, Date.now());

    const player = playerRef.current;
    if (!player) return;

    if (
      !shouldApplyPlayerEvent(parsed, {
        selfId: userId,
        localSource: "VIMEO",
        lastAppliedTs: lastAppliedTsRef.current,
      })
    ) {
      return;
    }
    lastAppliedTsRef.current = parsed.ts;

    if (parsed.type === "PLAY") {
      applyRemote(async () => {
        await player.setCurrentTime(parsed.time);
        await player.play();
        setIsPlayingLocal(true);
      });
    } else if (parsed.type === "PAUSE") {
      applyRemote(async () => {
        await player.setCurrentTime(parsed.time);
        await player.pause();
        setIsPlayingLocal(false);
      });
    } else if (parsed.type === "SEEK") {
      applyRemote(() => player.setCurrentTime(parsed.time));
      setCurrentTime(parsed.time);
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
        const { time: expected, stale } = expectedPlaybackTime(
          snapshot,
          duration,
          skewFor(skewRef.current, snapshot.lastActorId),
        );
        if (stale) return; // snapshot abandonado: não arrasta ninguém
        if (Math.abs(localTime - expected) > DRIFT_THRESHOLD_NATIVE_S) {
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
      const evt: PlayerEvent = {
        type: "SEEK",
        time: seconds,
        source: "VIMEO",
        actorId: userId,
        ts: Date.now(),
      };
      lastAppliedTsRef.current = evt.ts;
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
    resolution: targetResolution,
    fpsLimit: "auto",
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  };

  return { isReady, error, controller };
}
