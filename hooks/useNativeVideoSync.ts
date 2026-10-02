"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBroadcastEvent, useEventListener, useMutation, useStorage } from "@liveblocks/react";
import { isHlsUrl } from "@/lib/video-source";
import { HLS_MODULE, setMaxBufferLength, type Hls, type HlsStatic } from "@/lib/hls";
import {
  getPlaybackSnapshot,
  resetPlaybackClock,
  setPlayback,
} from "@/hooks/usePlaybackClock";
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
  // Se o hls.js está disponível neste browser. `null` = ainda não sabemos (o
  // módulo é carregado sob demanda); `false` = carregou e não dá para usar, ou
  // o import falhou.
  //
  // Existe estado em vez de uma chamada síncrona a `Hls.isSupported()` porque o
  // módulo virou `import()` dinâmico: a capability só é consultável DEPOIS
  // que o chunk chega, e a resposta é a mesma para a sessão inteira. O botão de
  // resolução usa isto como gate, então um `null` inicial o mantém fora de cena
  // até haver resposta — que é o comportamento correto para um controle
  // inerte.
  const [hlsSupported, setHlsSupported] = useState<boolean | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const loadedUrlRef = useRef<string | null>(null);
  const targetResolutionRef = useRef(targetResolution);
  const fpsLimitRef = useRef(fpsLimit);
  // desvio de relógio estimado por ator e maior `ts` já aplicado (last-write-wins)
  const skewRef = useRef<SkewSamples>({});
  const lastAppliedTsRef = useRef<number | null>(null);

  // Estado do player vai para a store externa (`usePlaybackClock`), não para
  // `useState` aqui dentro. A diferença é o efeito em cascata: `timeupdate` do
  // `<video>` dispara ~4 Hz, e um `useState` aqui re-renderizaria
  // `RoomExperience` e a subárvore inteira (chat, presença, sync ring) quatro
  // vezes por segundo, sem nada naqueles componentes ter mudado. Ver
  // `hooks/usePlaybackClock.ts`.
  //
  // `isReady` e `error` continuam em `useState`: mudam em transições, não em
  // fluxo, e `RoomExperience` precisa do valor no render para escolher a tela
  // do player.
  const setIsPlayingLocal = useCallback((isPlaying: boolean) => setPlayback({ isPlaying }), []);
  const setCurrentTime = useCallback((currentTime: number) => setPlayback({ currentTime }), []);
  const setDuration = useCallback((duration: number) => setPlayback({ duration }), []);
  const setVolumeLocal = useCallback((volume: number) => setPlayback({ volume }), []);
  const setIsMutedLocal = useCallback((isMuted: boolean) => setPlayback({ isMuted }), []);

  const applyRemote = useCallback((fn: () => void) => {
    isApplyingRemoteRef.current = true;
    fn();
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, REMOTE_APPLY_COOLDOWN_MS);
  }, []);

  // Zera o relógio ao desmontar: a store é de módulo e sobrevive à sala.
  useEffect(() => resetPlaybackClock, []);

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
      // `hlsSupported` NÃO é zerado aqui de propósito: ele descreve uma
      // capability do browser, não da fonte, e zerá-lo exigiria um setState no
      // corpo do efeito (render em cascata, proibido pelo lint). O botão de
      // resolução já exige `isHlsUrl(...)` além de `hlsSupported`, então uma
      // sala sem hls.js não o mostra de qualquer forma.
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

    // Não-HLS (.mp4/.webm) e HLS-nativo do Safari vão direto pelo atributo
    // `src` — nenhum módulo involved. O hls.js só é buscado quando a URL é
    // mesmo um manifest e o browser precisa dele.
    if (!isHlsUrl(url)) {
      videoEl.src = url;
      loadedUrlRef.current = url;
      return () => {
        cancelled = true;
      };
    }

    // O caminho assíncrono é isolado numa função para que o cleanup do efeito
    // continue sendo uma função de retorno síncrona: o efeito precisa poder
    // marcar `cancelled` no cleanup, e `await` no meio do corpo do efeito
    // faria o cleanup ser registrado tarde demais.
    void (async () => {
      let HlsCtor: HlsStatic;
      try {
        HlsCtor = await HLS_MODULE();
      } catch {
        // Falha de rede/CDN no chunk: cai no HLS nativo do elemento, que
        // funciona no Safari e em qualquer browser com suporte nativo. Sem
        // isto, a sala ficava em "carregando" para sempre.
        if (cancelled) return;
        setHlsSupported(false);
        videoElRef.current = null;
        const el = document.getElementById(containerId) as HTMLVideoElement | null;
        if (!el) return;
        el.src = url;
        loadedUrlRef.current = url;
        return;
      }

      if (cancelled) return;
      if (!HlsCtor.isSupported()) {
        setHlsSupported(false);
        videoEl.src = url;
        loadedUrlRef.current = url;
        return;
      }
      setHlsSupported(true);

      const hls = new HlsCtor();
      hlsRef.current = hls;
      hls.on(HlsCtor.Events.ERROR, (_evt, data) => {
        if (cancelled) return;
        const fatal = (data as { fatal?: boolean } | null)?.fatal;
        if (fatal) {
          setError("falha ao carregar o stream (manifest/rede). tente carregar de novo.");
        }
      });
      // teto de resolução (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.4) — autoLevelCapping mantém o ABR
      // vivo abaixo do limite, ao contrário de currentLevel/loadLevel (que
      // fixam o nível e cortam a capacidade de cair de qualidade em rede
      // ruim). Registrado antes de loadSource: MANIFEST_PARSED dispara antes
      // da escolha do primeiro fragmento, então o teto já vale de cara.
      const heightForTarget = (t: Resolution) => (t === "480p" ? 480 : 720);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        const maxHeight = heightForTarget(targetResolutionRef.current);
        const cap = hls.levels.reduce(
          (best, lvl, i) =>
            lvl.height <= maxHeight && (best < 0 || lvl.height > hls.levels[best].height) ? i : best,
          -1,
        );
        hls.autoLevelCapping = cap;
        if (fpsLimitRef.current === "30") {
          setMaxBufferLength(hls, 2);
        }
      });
      hls.loadSource(url);
      hls.attachMedia(videoEl);
      loadedUrlRef.current = url;
    })();

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
  }, [
    video?.embedUrl,
    video?.loadedAt,
    userId,
    commitPlayer,
    broadcast,
    applyRemote,
    setCurrentTime,
    setDuration,
    setVolumeLocal,
    setIsMutedLocal,
    setIsPlayingLocal,
  ]);

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
    // `null` restaura o DEFAULT do hls.js, não `undefined` — ver
    // `setMaxBufferLength` em lib/hls.ts para por que a diferença importa
    // (o buffer-controller faz `Math.min(x, undefined)` = `NaN`).
    setMaxBufferLength(hls, fpsLimit === "30" ? 2 : null);
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
  //
  // `hlsSupported === null` (módulo ainda não carregado) conta como "não": o
  // botão fica `null` e o `PlayerControls` o esconde. O efeito que carrega o
  // módulo roda na mesma Mount, então a resposta chega antes de o usuário
  // conseguir clicar em qualquer coisa.
  const canCapResolution = isHlsUrl(video?.embedUrl ?? "") && hlsSupported === true;

  // Os campos de estado são GETTERS sobre a store, não valores copiados.
  //
  // É o que mantém a leitura correta sem re-render: `controller.currentTime`
  // usado pelo handler de teclado ou pelo drift correction tem que ser o valor
  // do instante da chamada, e um valor copiado no render carregaria o
  // playhead de até 4 Hz atrás. O componente que precisa REAGIR ao valor
  // assina a store por hook (`useCurrentTime` / `usePlaybackState`), não por
  // este objeto — ver `hooks/usePlaybackClock.ts`.
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
