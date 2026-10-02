"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import type { PlayerEvent, RoomStorage } from "@/liveblocks.config";
import {
  VIMEO_MODULE,
  type VimeoPlayer,
  type VimeoPlayerCtor,
  type VimeoQuality,
} from "@/lib/vimeo";
import {
  getPlaybackSnapshot,
  resetPlaybackClock,
  setPlayback,
} from "@/hooks/usePlaybackClock";
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
function capQuality(player: VimeoPlayer, resolution: Resolution = "720p") {
  const maxHeight = RESOLUTION_MAX_HEIGHT[resolution];
  player
    .getQualities()
    .then((qualities: VimeoQuality[]) => {
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

  const playerRef = useRef<VimeoPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Instância em construção, para que o cleanup do efeito possa abortar um
  // carregamento do SDK que ainda não voltou. Sem isto, trocar de fonte durante
  // o `import()` deixaria o player ser criado contra um container já
  // desmontado.
  const buildTokenRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  // desvio de relógio estimado por ator e maior `ts` já aplicado (last-write-wins)
  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);
  // A resolução é aplicada por efeitos próprios; mantê-la fora das deps do
  // efeito de criação abaixo é o que impede alternar 720p/480p de RECARREGAR o
  // vídeo (e de deixar `isReady` preso em false no meio do caminho).
  const targetResolutionRef = useRef(targetResolution);

  // Estado do player vai para a store externa (`usePlaybackClock`), não para
  // `useState` aqui dentro.
  //
  // A diferença é o efeito em cascata: o evento `timeupdate` do SDK do Vimeo
  // chega ~4 Hz, e um `useState` aqui re-renderizaria `RoomExperience` e a
  // subárvore inteira — chat com 30 itens, presença, sync ring — quatro vezes
  // por segundo, sem nada naqueles componentes ter mudado. Ver
  // `hooks/usePlaybackClock.ts`.
  const setIsPlayingLocal = useCallback((isPlaying: boolean) => setPlayback({ isPlaying }), []);
  const setCurrentTime = useCallback((currentTime: number) => setPlayback({ currentTime }), []);
  const setDuration = useCallback((duration: number) => setPlayback({ duration }), []);
  const setVolumeLocal = useCallback((volume: number) => setPlayback({ volume }), []);
  const setIsMutedLocal = useCallback((isMuted: boolean) => setPlayback({ isMuted }), []);

  // Zera o relógio ao desmontar: a store é de módulo e sobrevive à sala.
  useEffect(() => resetPlaybackClock, []);

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
    const applySnapshot = (target: VimeoPlayer) => {
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

    // A construção do player virou assíncrona porque o SDK virou import()
    // dinâmico (ver lib/vimeo.ts). Isolar num IIFE mantém o cleanup do efeito
    // como retorno SÍNCRONO — o efeito precisa marcar `cancelled` no cleanup, e
    // um `await` no corpo do efeito registraria o cleanup tarde demais.
    const token = ++buildTokenRef.current;
    void (async () => {
      let Player: VimeoPlayerCtor;
      try {
        Player = await VIMEO_MODULE();
      } catch {
        if (cancelled || token !== buildTokenRef.current) return;
        setError("falha ao carregar o player do Vimeo. tente carregar o vídeo de novo.");
        return;
      }

      // Re-checagem depois do await: entre a partida e a chegada do módulo a
      // fonte pode ter mudado, o efeito pode ter rodado de novo (loadedAt) ou
      // o componente pode ter desmontado. `cancelled` cobre o cleanup;
      // `token` cobre a corrida entre duas execuções do efeito.
      if (cancelled || token !== buildTokenRef.current) return;

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
        if (cancelled) return;
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

      player.on("timeupdate", ({ seconds, duration: total }) => {
        setCurrentTime(seconds ?? 0);
        if (total) setDuration(total);
      });

      player.on("play", ({ seconds }) => {
        const at = seconds ?? 0;
        setIsPlayingLocal(true);
        if (isApplyingRemoteRef.current) return;
        const evt: PlayerEvent = {
          type: "PLAY",
          time: at,
          source: "VIMEO",
          actorId: userId,
          ts: Date.now(),
        };
        lastAppliedTsRef.current = evt.ts;
        commitPlayer({ isPlaying: true, currentTime: at, updatedAt: evt.ts, lastActorId: userId });
        broadcast(evt);
      });

      player.on("pause", ({ seconds }) => {
        const at = seconds ?? 0;
        setIsPlayingLocal(false);
        if (isApplyingRemoteRef.current) return;
        const evt: PlayerEvent = {
          type: "PAUSE",
          time: at,
          source: "VIMEO",
          actorId: userId,
          ts: Date.now(),
        };
        lastAppliedTsRef.current = evt.ts;
        commitPlayer({ isPlaying: false, currentTime: at, updatedAt: evt.ts, lastActorId: userId });
        broadcast(evt);
      });

      player.on("seeked", ({ seconds }) => {
        const at = seconds ?? 0;
        if (isApplyingRemoteRef.current) return;
        const base = playerStorageRef.current;
        const evt: PlayerEvent = {
          type: "SEEK",
          time: at,
          source: "VIMEO",
          actorId: userId,
          ts: Date.now(),
        };
        lastAppliedTsRef.current = evt.ts;
        commitPlayer({
          isPlaying: base?.isPlaying ?? false,
          currentTime: at,
          updatedAt: evt.ts,
          lastActorId: userId,
        });
        broadcast(evt);
      });
    })();

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
          // Lido da store no instante do tick, não de um `duration` capturado
          // no render: com o estado fora do React, um valor de closure ficaria
          // congelado e o clamp por duração pararia de valer.
          getPlaybackSnapshot().duration,
          skewFor(skewRef.current, snapshot.lastActorId),
        );
        if (stale) return; // snapshot abandonado: não arrasta ninguém
        if (Math.abs(localTime - expected) > DRIFT_THRESHOLD_NATIVE_S) {
          applyRemote(() => player.setCurrentTime(expected));
        }
      });
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
    // `duration` sai das deps de propósito: lido da store dentro do tick.
  }, [isReady, userId, applyRemote]);

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
    // Lido da store, não de um valor de closure: o comando decide pelo estado
    // real no instante do clique, e o `play`/`pause` do SDK resolve assíncrono.
    if (getPlaybackSnapshot().isPlaying) playerRef.current?.pause();
    else playerRef.current?.play();
  }, []);

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
        isPlaying: getPlaybackSnapshot().isPlaying,
        currentTime: seconds,
        updatedAt: evt.ts,
        lastActorId: userId,
      });
      broadcast(evt);
    },
    [userId, commitPlayer, broadcast, applyRemote, setCurrentTime],
  );

  const setVolume = useCallback(
    (v: number) => {
      playerRef.current?.setVolume(v);
      setVolumeLocal(v);
      if (v > 0) {
        playerRef.current?.setMuted(false);
        setIsMutedLocal(false);
      }
    },
    [setVolumeLocal, setIsMutedLocal],
  );

  const toggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const next = !getPlaybackSnapshot().isMuted;
    player.setMuted(next);
    setIsMutedLocal(next);
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
