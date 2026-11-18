"use client";

import { useCallback, useState } from "react";
import { useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useVimeoSync } from "@/hooks/useVimeoSync";
import { useNativeVideoSync } from "@/hooks/useNativeVideoSync";
import { useLastRoomEvent } from "@/hooks/useLastRoomEvent";
import { useRoomJoinAnnouncement } from "@/hooks/useRoomJoinAnnouncement";
import { useRoomLeaveAnnouncement } from "@/hooks/useRoomLeaveAnnouncement";
import { useEconomyMode } from "@/hooks/useEconomyMode";
import { useBroadcastGate } from "@/hooks/useBroadcastGate";
import { useReleaseOnLeave } from "@/hooks/useReleaseOnLeave";
import { useRoomShortcuts } from "@/hooks/useRoomShortcuts";
import { useStageLayout } from "@/hooks/useStageLayout";
import { hasActiveHold, useIdleHide } from "@/hooks/useIdleHide";
import { CHAT_PANEL_ID } from "@/components/room/chat/ids";
import { useOwnAvatarVersion } from "@/hooks/useOwnAvatarVersion";
import { SyncRing } from "@/components/room/SyncRing";
import { isSafeEmbedUrl } from "@/lib/video-source";
import { PlayerLoadStatus } from "@/components/room/PlayerLoadStatus";
import { PlayerShell } from "@/components/room/player/PlayerShell";
import { LoadVideoModal } from "@/components/room/player/LoadVideoModal";
import { RoomActions } from "@/components/room/RoomActions";
import { RoomHeader } from "@/components/room/RoomHeader";
import {
  NATIVE_CONTAINER_ID,
  VIMEO_CONTAINER_ID,
  VideoSurface,
  YT_CONTAINER_ID,
} from "@/components/room/VideoSurface";
import { Chat } from "@/components/room/Chat";
import { usePresenceAccessory } from "@/components/room/PresenceAccessory";
import { useVideoQuality } from "@/hooks/useVideoQuality";
import { RoomIris } from "@/components/room/RoomIris";
import { usePlaybackState } from "@/hooks/usePlaybackClock";
import { EconomySuggestion } from "@/components/room/EconomySuggestion";
import { ScreenSharePlayer } from "@/components/room/ScreenSharePlayer";

// Exportado porque `RoomExperience` é o único consumidor do retorno de
// `useVideoQuality`, e o teste da sala monta a prop a partir daqui em vez de
// duplicar a forma.
export type VideoQuality = ReturnType<typeof useVideoQuality>;

// respiro em tela cheia — declarado uma vez, usado no padding do stage e no
// cálculo de altura máxima da caixa do vídeo (docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.1).
const FULLSCREEN_PAD = "clamp(0.75rem,2.5vmin,2.5rem)";

export function RoomExperience({
  roomCode,
  roomName,
  userId,
  userName,
  avatarV: initialAvatarV,
  videoQuality,
  livekitUrl,
}: {
  roomCode: string;
  roomName: string | null;
  userId: string;
  userName: string;
  avatarV?: number | null;
  videoQuality: VideoQuality;
  // `null` quando o Livekit não está configurado no deploy. O botão de
  // transmissão não renderiza nesse caso: sem SFU não há para onde publicar, e
  // um botão que falha ao ser clicado é pior do que botão nenhum
  // (FR-010, degradação em lib/livekit.ts).
  livekitUrl: string | null;
}) {
  const video = useStorage((root) => root.video);
  const player = useStorage((root) => root.player);
  const { broadcast, isBroadcasting, showScreenShare, giveUpOnBroadcast } = useBroadcastGate(livekitUrl);
  const avatarV = useOwnAvatarVersion(initialAvatarV);
  const lastEvent = useLastRoomEvent();
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  // fica aqui (nível de sala, sempre montado) e não dentro de <Chat> — o
  // aside com o Chat desmonta/remonta ao entrar em fullscreen ou alternar
  // teatro, o que reenviava "entrou na sala" a cada toggle (bug real).
  useRoomJoinAnnouncement(userName);
  // O feed de chat NÃO é estado deste componente (FR-001/FR-002,
  // docs/specs/13-chat-sala/spec.md): ele vive na store de `lib/chat-feed.ts` e
  // é assinado dentro do `<Chat>`. Com `useChat` aqui, cada mensagem recebida
  // acordava a árvore inteira da sala — presença, sync, player, cabeçalho
  // (medido em docs/specs/13-chat-sala/research.md, seção 2). O que fica aqui é
  // só o emissor, dentro do `<Chat>`, e o reset da store no mount.
  useRoomLeaveAnnouncement(userId);

  const {
    resolution,
    fpsLimit,
    economyMode,
    setResolution,
    setEconomyMode,
    setFpsLimit,
    isLowEnd,
    isSafari,
    hasSeenSuggestion,
    dismissSuggestion,
    captions,
    setCaptions,
  } = videoQuality;
  const effectiveResolution = economyMode && resolution === "720p" ? "480p" : resolution;

  useEconomyMode(economyMode);

  const {
    stageRef,
    isFullscreen,
    cssFullscreen,
    isTheater,
    showAside,
    toggleFullscreen,
    toggleTheater,
    exitCssFullscreen,
  } = useStageLayout();


  // identidade estável — RoomExperience re-renderiza a cada evento do
  // Liveblocks (chat, presença, sync); um `() => setLoadModalOpen(false)`
  // inline mudaria de referência a cada um desses renders e re-disparava o
  // efeito de teclado do modal enquanto ele está aberto (docs/specs/03-auditoria-ui-ux/spec.md, seção 10).
  const closeLoadModal = useCallback(() => setLoadModalOpen(false), []);
  const openLoadModal = useCallback(() => setLoadModalOpen(true), []);
  const toggleFps = useCallback(() => {
    const next = fpsLimit === "auto" ? "30" : fpsLimit === "30" ? "60" : "auto";
    setFpsLimit(next);
  }, [fpsLimit, setFpsLimit]);
  const toggleEconomy = useCallback(() => setEconomyMode(!economyMode), [economyMode, setEconomyMode]);
  const toggleCaptions = useCallback(() => setCaptions(!captions), [captions, setCaptions]);

  // Alterna a preferência global de resolução (quem é dono do estado é
  // useVideoQuality; os hooks de sync só informam se a fonte aceita).
  const toggleResolution = useCallback(() => {
    setResolution(resolution === "720p" ? "480p" : "720p");
  }, [resolution, setResolution]);

  const { isReady: youtubeReady, error: youtubeError, controller: youtubeController } =
    useYouTubeSync({ containerId: YT_CONTAINER_ID, userId, captions });
  const { isReady: vimeoReady, error: vimeoError, controller: vimeoController } = useVimeoSync({
    containerId: VIMEO_CONTAINER_ID,
    userId,
    targetResolution: effectiveResolution,
  });
  const { isReady: nativeReady, error: nativeError, controller: nativeController } =
    useNativeVideoSync({ containerId: NATIVE_CONTAINER_ID, userId, targetResolution: effectiveResolution, fpsLimit });

  // `useStorage` devolve null enquanto o storage do Liveblocks não sincroniza.
  // Sem distinguir isso de "sala sem vídeo", o primeiro frame de uma sala que
  // JÁ tem vídeo era o estado vazio dizendo pra carregar um (achado 11).
  const storageLoading = video === null || player === null;

  const hasYouTube = video?.source === "YOUTUBE" && !!video.embedUrl;
  const hasVimeo = video?.source === "VIMEO" && !!video.embedUrl;
  const hasDirectMedia = video?.source === "DIRECT_MEDIA" && !!video.embedUrl;
  const hasGeneric = video?.source === "GENERIC_IFRAME" && !!video.embedUrl;
  const syncLimited = video?.source === "GENERIC_IFRAME";

  const playerLoading =
    (hasYouTube && !youtubeReady) || (hasVimeo && !vimeoReady) || (hasDirectMedia && !nativeReady);
  const playerError = hasYouTube
    ? youtubeError
    : hasVimeo
      ? vimeoError
      : hasDirectMedia
        ? nativeError
        : null;
  const activeController = hasYouTube
    ? youtubeController
    : hasVimeo
      ? vimeoController
      : hasDirectMedia
        ? nativeController
        : null;

  // "ao vivo" e o anel de sync saem do player local, não do snapshot cru do
  // storage: ninguém escreve `isPlaying:false` ao fechar a aba, então uma sala
  // reaberta exibia "AO VIVO" com o anel pulsando sobre um vídeo parado
  // (achado 10). Com sync funcionando, estado local == estado da sala.
  //
  // Assinado pela store, e não por `activeController.isPlaying`: o controller
  // expõe o estado por getter sobre a store (ver `usePlaybackClock.ts`), então
  // ler o getter aqui devolveria o valor do último render DESTE componente —
  // que não re-renderiza a cada tick. A assinatura é o que re-renderiza, e
  // como `isPlaying` muda em transição (não a 4 Hz), o custo é irrelevante
  // frente ao que a assinatura do playhead trazia junto.
  const { isPlaying: playingFromClock } = usePlaybackState();
  const isPlayingNow = activeController ? playingFromClock : false;

  const isStageHeld = useCallback(() => hasActiveHold(stageRef.current), [stageRef]);
  const { idle, wake } = useIdleHide({
    enabled: !!activeController && isPlayingNow && !isBroadcasting,
    isHeld: isStageHeld,
  });

  useReleaseOnLeave();
  useRoomShortcuts({
    activeController,
    loadModalOpen,
    cssFullscreen,
    isBroadcasting,
    toggleFullscreen,
    exitCssFullscreen,
  });

  const presenceAccessory = usePresenceAccessory(userId, userName, avatarV);

  const onAcceptEconomySuggestion = useCallback(() => {
    setEconomyMode(true);
    setResolution("480p");
  }, [setEconomyMode, setResolution]);

  return (
    <main className="room-shell flex h-dvh w-full flex-col overflow-hidden">
      <RoomIris />
      <div
        ref={stageRef}
        data-idle={idle}
        onMouseMove={wake}
        onPointerDown={wake}
        onTouchStart={wake}
        onKeyDown={wake}
        onFocusCapture={wake}
        style={
          isFullscreen
            ? ({ padding: FULLSCREEN_PAD, "--fs-pad": FULLSCREEN_PAD } as React.CSSProperties)
            : undefined
        }
        className={`relative flex min-h-0 flex-1 flex-col bg-[var(--bg-void)] lg:flex-row ${
          isFullscreen ? "h-dvh w-dvw overflow-hidden" : ""
        } ${idle ? "[&_*]:cursor-none" : ""} ${cssFullscreen ? "fixed inset-0 z-50" : ""}`}
      >
        <div
          className={`relative flex min-h-0 min-w-0 flex-col ${
            isFullscreen
              ? "flex-1 gap-4 [justify-content:safe_center]"
              : "max-lg:shrink-0 lg:flex-1"
          } ${isFullscreen && showAside ? "lg:basis-[78%]" : ""}`}
        >
          <div className={isFullscreen ? "hidden" : "px-3 pt-3 sm:px-4 lg:px-5"}>
            <RoomHeader
              roomCode={roomCode}
              roomName={roomName}
              userId={userId}
              userName={userName}
              avatarV={avatarV}
              livekitUrl={livekitUrl}
              broadcast={broadcast}
              videoSourceUrl={video?.sourceUrl ?? null}
              lastEvent={lastEvent}
              isPlayingNow={isPlayingNow}
              syncLimited={syncLimited}
              isBroadcasting={isBroadcasting}
              economyMode={economyMode}
              isTheater={isTheater}
              isFullscreen={isFullscreen}
              onLoadVideo={openLoadModal}
              onToggleTheater={toggleTheater}
              onToggleEconomy={toggleEconomy}
            />
          </div>

          {isFullscreen && (
            <div
              data-idle-hold=""
              className={`absolute right-3 top-3 z-20 transition-opacity duration-[calc(var(--motion-dur)*var(--motion-factor))] ${
                idle ? "pointer-events-none opacity-0" : "opacity-60 hover:opacity-100 focus-within:opacity-100"
              }`}
            >
              <RoomActions
                onLoadVideo={openLoadModal}
                onToggleTheater={toggleTheater}
                isTheater={isTheater}
                showTheaterToggle
                onToggleEconomy={toggleEconomy}
                isEconomy={economyMode}
              />
            </div>
          )}

          <div
            className={
              isFullscreen
                ? "flex flex-col gap-3"
                : "flex flex-col gap-3 px-3 pt-3 pb-3 sm:px-4 lg:min-h-0 lg:flex-1 lg:px-5 lg:pb-5"
            }
          >
            <div
              className={`w-full ${
                isFullscreen
                  ? "mx-auto max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))]"
                  : "mx-auto max-lg:max-w-[min(100%,max(16rem,calc((100dvh-17rem)*16/9)))] lg:min-h-0 lg:flex-1"
              }`}
            >
              <SyncRing
                isPlaying={isBroadcasting ? false : isPlayingNow}
                source={isBroadcasting ? null : (video?.source ?? null)}
                lastEvent={lastEvent}
                isFullscreen={isFullscreen}
                economyMode={economyMode}
                className={isFullscreen ? "" : "lg:h-full"}
              >
                <div
                  className={`relative w-full overflow-hidden rounded-sm bg-black ${
                    isFullscreen ? "aspect-video" : "aspect-video lg:aspect-auto lg:h-full"
                  }`}
                >
                  {showScreenShare ? (
                    <ScreenSharePlayer broadcast={broadcast!} onGiveUp={giveUpOnBroadcast} />
                  ) : (
                    <PlayerShell
                      controller={activeController}
                      isFullscreen={isFullscreen}
                      idle={idle}
                      onToggleFullscreen={toggleFullscreen}
                      showFullscreenOnly={hasGeneric}
                      sourceType={video?.source ?? null}
                      isSafari={isSafari}
                      fpsLimit={fpsLimit}
                      onToggleFps={hasDirectMedia ? toggleFps : undefined}
                      onToggleResolution={
                        activeController && activeController.resolution !== null
                          ? toggleResolution
                          : undefined
                      }
                      captions={hasYouTube ? captions : null}
                      onToggleCaptions={hasYouTube ? toggleCaptions : undefined}
                    >
                      <VideoSurface
                        video={video}
                        hasYouTube={hasYouTube}
                        hasVimeo={hasVimeo}
                        hasDirectMedia={hasDirectMedia}
                        hasGeneric={hasGeneric}
                        storageLoading={storageLoading}
                        youtubeController={youtubeController}
                        roomCode={roomCode}
                        userId={userId}
                      />
                    </PlayerShell>
                  )}
                  {!isBroadcasting && (
                    <PlayerLoadStatus
                      key={`${video?.embedUrl}-${video?.loadedAt}`}
                      loading={playerLoading}
                      error={playerError}
                      sourceUrl={video?.sourceUrl ?? null}
                    />
                  )}
                </div>
              </SyncRing>
            </div>

            {!isBroadcasting && hasGeneric && isSafeEmbedUrl(video!.embedUrl!) && (
              <p className="shrink-0 text-caption text-[var(--ink-muted)]">
                Se a prévia não aparecer, o site pode não permitir incorporação —{" "}
                <a
                  href={video!.embedUrl!}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-sm text-[var(--ink)] underline reticle"
                >
                  Abrir em nova aba
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <aside
          id={CHAT_PANEL_ID}
          style={
            isFullscreen && isTheater
              ? ({ "--focus-offset": "var(--bg-surface)" } as React.CSSProperties)
              : undefined
          }
          className={`w-full min-h-0 flex-col gap-5 overflow-y-auto max-lg:flex-1 ${
            isFullscreen
              ? "lg:min-w-80 lg:basis-[22%]"
              : "border-t border-[var(--gold-edge)] bg-[var(--bg-surface)]/60 lg:w-[24rem] lg:shrink-0 lg:border-t-0 lg:border-l"
          } ${showAside ? "flex" : "hidden"} ${
            isFullscreen && isTheater
              ? "rounded-sm border border-[var(--line)] bg-[var(--bg-surface)] p-4"
              : isFullscreen
                ? "p-2"
                : "px-3 pt-3 pb-14 sm:px-4 lg:px-4 lg:pt-4"
          }`}
        >
          <section className="flex min-h-11 flex-1 flex-col gap-3">
            <Chat
              userId={userId}
              userName={userName}
              avatarV={avatarV}
              roomCode={roomCode}
              headerAccessory={presenceAccessory}
              onClose={isFullscreen && isTheater ? toggleTheater : undefined}
            />
          </section>
        </aside>

        <LoadVideoModal
          roomCode={roomCode}
          userId={userId}
          open={loadModalOpen}
          onClose={closeLoadModal}
        />
      </div>
      <EconomySuggestion
        isLowEnd={isLowEnd}
        hasSeenSuggestion={hasSeenSuggestion}
        onAccept={onAcceptEconomySuggestion}
        onDismiss={dismissSuggestion}
      />
    </main>
  );
}
