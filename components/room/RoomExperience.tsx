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

// altura ocupada pelo chrome da página fora de tela cheia (header + pt-8 +
// gap + pb-14 reservado pro badge do Liveblocks). Entra no teto de altura da
// caixa do vídeo: sem isso o vídeo era dimensionado só pela largura e, num
// laptop 16:9, a barra de controles caía abaixo da dobra (achado 4).
// PAGE_CHROME = 10rem — está escrito literalmente na classe do vídeo abaixo
// (o Tailwind não extrai classe montada por interpolação); mudar um exige
// mudar o outro.

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
    // A casca é de altura fixa (`room-shell` = `h-dvh` + `overflow-hidden`), como
    // manda a FR-049: assim o chat recebe uma altura definida, o log rola por
    // dentro e a página não rola. A exceção mora no `globals.css`: com a
    // viewport abaixo de `32em` de altura — o que inclui o texto do usuário a
    // 200%, porque a unidade é `em` — a casca vira altura mínima e a PÁGINA
    // passa a rolar. Sem isso, o conteúdo não cabia e era espremido: o composer
    // saía da caixa e, no reflow da WCAG (320×256), o vídeo ficava 0×0 — perda
    // de conteúdo (achado 12 da revisão de design).
    // pb-14 SEM a exceção `max-lg:pb-4` que existia aqui: o selo do Liveblocks
    // ocupa 12px + 38px a partir da borda inferior, então 16px de respiro no
    // mobile deixavam o selo por cima do campo de mensagem (medido a 390px:
    // selo em y 794-832, input em y 784-828 — achado 1 da revisão de design).
    <main className="room-shell mx-auto flex h-dvh w-full max-w-[1800px] flex-col gap-5 overflow-hidden px-4 pt-6 pb-14 sm:px-6 lg:px-8">
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


      <div
        ref={stageRef}
        style={
          isFullscreen
            ? ({ padding: FULLSCREEN_PAD, "--fs-pad": FULLSCREEN_PAD } as React.CSSProperties)
            : undefined
        }
        className={`relative flex min-h-0 flex-1 flex-col gap-5 bg-[var(--bg-void)] lg:flex-row ${
          isFullscreen ? "h-dvh w-dvw overflow-hidden" : ""
        } ${cssFullscreen ? "fixed inset-0 z-50" : ""}`}
      >
        <div
          // p-4 -m-4: overflow-y-auto (necessário pro fallback de iframe
          // genérico não ficar inacessível, ver item 14.1) força overflow-x
          // pra "auto" também (regra do spec de CSS quando só um eixo é
          // "auto") — sem esse respiro, o glow do SyncRing "ao vivo"
          // (box-shadow que sangra ~15px pra fora da caixa) era recortado
          // nos três lados em vez de vazar pro gap. A margem negativa
          // cancela o respiro na largura ocupada pelos irmãos flex.
          className={`relative flex min-h-0 flex-col gap-4 overflow-y-auto p-4 -m-4 ${
            isFullscreen ? "[justify-content:safe_center]" : ""
          } ${
            showAside ? "lg:basis-[78%]" : "w-full"
          } ${isFullscreen ? "flex-1" : "max-lg:shrink-0"}`}
        >
          {isFullscreen && !isTheater && (
            <div className="absolute right-3 top-3 z-20 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100">
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

          {/* o teto de largura mora AQUI, em volta do SyncRing, e não na caixa
              do vídeo: a moldura de sync precisa continuar colada no vídeo
              quando o limite de altura entra em ação, senão a borda passa a
              contornar a coluna inteira com faixas pretas dos dois lados.
              Dois eixos, não só a largura. Empilhado (<lg) o teto é o que
              SOBRA da altura depois do chrome fixo (paddings do main, header,
              os dois gaps) e do mínimo da aside (presença + emojis + composer):
              quem cede altura é o vídeo, nunca o campo de mensagem (achado 10
              da revisão de design). O `max(16rem, ...)` é o PISO: sem ele, em
              janela muito curta a conta fica negativa e o vídeo colapsava para
              0×0 — conteúdo perdido, não encolhido (achado 12). Lado a lado
              (lg+) o desconto do chrome é 10rem, como antes. Classe literal
              porque o Tailwind não extrai string interpolada (achados 4 e 9). */}
          <div
            className={`w-full ${
              isFullscreen
                ? "mx-auto max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))]"
                : "mx-auto max-w-[min(100%,max(16rem,calc((100dvh-22rem)*16/9)))] lg:max-w-[min(100%,calc((100dvh-10rem)*16/9))]"
            }`}
          >
            {/* `isPlaying` e `source` zerados no modo transmissão: a moldura de
                sync e o selo "sync limitado — controle manual" descrevem o
                sync layer, e no modo transmissão o sync layer não participa
                (FR-004, docs/specs/12-transmissao-screen-share/spec.md, seção 1).
                Um anel pulsando sobre a transmissão dos outros seria um
                affordance de controle que não existe. */}
            <SyncRing
              isPlaying={isBroadcasting ? false : isPlayingNow}
              source={isBroadcasting ? null : (video?.source ?? null)}
              lastEvent={lastEvent}
              isFullscreen={isFullscreen}
              economyMode={economyMode}
            >
              {/* bg-black literal de propósito (não --bg-void): é a letterbox
                  atrás do vídeo, não uma superfície da UI — ver revisão de
                  consistência, achado 5 de docs/specs/06-consistencia-design/spec.md. */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              {/* FR-004/FR-005: o storage de transmissão é autoritativo sobre o
                  que a área de vídeo exibe. Com transmissão, nada de
                  `PlayerShell`/`PlayerControls` — os frames SÃO a
                  sincronização. Sem, a sala volta ao estado de player normal,
                  inclusive o "nenhum vídeo carregado": `video` e `player` não
                  foram tocados, então o vídeo que já estava carregado está
                  intacto. */}
              {showScreenShare ? (
                // `broadcast` é não-nulo sempre que `isBroadcasting` é: o gate
                // só acrescenta a condição do Livekit. O `!` fica explícito
                // porque um `null` aqui renderizaria um player com um
                // `ScreenSharePlayer` sem nome, que é pior que o fallback.
                <ScreenSharePlayer
                  broadcast={broadcast!}
                  onGiveUp={giveUpOnBroadcast}
                />
              ) : (
                <PlayerShell
                  controller={activeController}
                  isFullscreen={isFullscreen}
                  onToggleFullscreen={toggleFullscreen}
                  showFullscreenOnly={hasGeneric}
                  sourceType={video?.source ?? null}
                  isSafari={isSafari}
                  fpsLimit={fpsLimit}
                  // FPS só existe no caminho HLS (hls.js), então o botão só é
                  // oferecido em DIRECT_MEDIA — antes ele aparecia habilitado
                  // também em YouTube/Vimeo, onde não faz nada (spec 09, CA-2.3).
                  onToggleFps={hasDirectMedia ? toggleFps : undefined}
                  onToggleResolution={
                    activeController && activeController.resolution !== null
                      ? toggleResolution
                      : undefined
                  }
                  // Só o YouTube expõe um módulo de legenda com API. Vimeo e
                  // mídia direta usam o chrome nativo (que está escondido) ou
                  // não têm controle de legenda — o botão sairia habilitado e
                  // inerte, que é o defeito que o gate de resolução/FPS já
                  // evitou.
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
                  />
                </PlayerShell>
              )}
              {/* O scrim de carregamento/erro pertence ao player. Sobre a
                  transmissão ele anunciaria um erro que não existe — o
                  `ScreenSharePlayer` tem o próprio estado de espera. */}
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
            <p className="text-caption text-[var(--ink-muted)]">
              se a prévia não aparecer, o site pode não permitir incorporação —{" "}
              <a
                href={video!.embedUrl!}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-sm text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
              >
                abrir em nova aba
              </a>
              .
            </p>
          )}
        </div>

        {/* sempre montado, nunca condicionalmente renderizado — `<Chat>` guarda
            histórico em estado React local (useChat), e um unmount/remount a
            cada toggle de fullscreen/teatro zerava as mensagens (bug real,
            ver docs/specs/02-fullscreen-lag-qualidade/spec.md, seção 9.6). Visibilidade agora é só CSS (`hidden`). */}
        <aside
          style={
            isFullscreen && isTheater
              ? ({ "--focus-offset": "var(--bg-surface)" } as React.CSSProperties)
              : undefined
          }
          // `overflow-y-auto`: a aside é o último recurso de altura. Com o teto
          // do vídeo acima, ela recebe o suficiente para presença + chat em
          // qualquer viewport de altura razoável; abaixo disso ela rola, em vez
          // de pintar conteúdo fora da própria caixa (era assim que o composer
          // caía sob o selo do Liveblocks). Sem overflow, não rola e nada muda.
          //
          // `p-2 -m-2`: contêiner de rolagem RECORTA o que sai da caixa de
          // padding, e sem esse respiro o anel de foco do composer era cortado
          // na esquerda e embaixo (medido por diff de pixel: o anel aparecia de
          // x=8 a y=51 em vez de x=4 a y=56). Mesma técnica de `p-4 -m-4` já
          // usada na coluna do vídeo logo acima. Efeito colateral medido: o
          // `-m-2` mantém a borda esquerda do conteúdo onde estava, mas o
          // `lg:min-w-80` é mínimo de caixa de borda, então a largura útil da
          // coluna cai 16px no desktop. Em modo teatro vale o `p-4` de
          // verdade, que ali é padding pintado do painel.
          className={`w-full min-h-0 flex-col gap-5 overflow-y-auto max-lg:flex-1 lg:min-w-80 lg:basis-[22%] ${
            showAside ? "flex" : "hidden"
          } ${
            isFullscreen && isTheater
              ? "rounded-2xl border border-[var(--line)] bg-[var(--bg-surface)] p-4"
              : "p-2 -m-2"
          }`}
        >
          <section className="flex min-h-11 flex-1 flex-col gap-3">
            <Chat
              userId={userId}
              userName={userName}
              avatarV={avatarV}
              roomCode={roomCode}
              headerAccessory={presenceAccessory}
            />
          </section>
        </aside>

        {/* dentro da árvore do stageRef, não irmão dela — em tela cheia
            nativa só a subárvore de `document.fullscreenElement` é pintada;
            como filho de `<main>` o modal ficava fora da árvore renderizada
            e nunca aparecia (achado pós-deploy, item 14.6). `fixed inset-0`
            continua resolvendo contra o viewport normalmente aninhado aqui. */}
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
