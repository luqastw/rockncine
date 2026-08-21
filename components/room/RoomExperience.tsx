"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useOthers, useStatus, useStorage } from "@liveblocks/react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useVimeoSync } from "@/hooks/useVimeoSync";
import { useNativeVideoSync } from "@/hooks/useNativeVideoSync";
import { useLastRoomEvent } from "@/hooks/useLastRoomEvent";
import { useRoomJoinAnnouncement } from "@/hooks/useRoomJoinAnnouncement";
import { useRoomLeaveAnnouncement } from "@/hooks/useRoomLeaveAnnouncement";
import { useChat } from "@/hooks/useChat";
import { SyncRing } from "@/components/room/SyncRing";
import { PresenceList } from "@/components/room/PresenceList";
import { GenericIframe } from "@/components/room/GenericIframe";
import { isSafeEmbedUrl } from "@/lib/video-source";
import { NativeVideoPlayer } from "@/components/room/NativeVideoPlayer";
import { PlayerLoadStatus } from "@/components/room/PlayerLoadStatus";
import { PlayerShell } from "@/components/room/player/PlayerShell";
import { LoadVideoModal } from "@/components/room/player/LoadVideoModal";
import { RoomActions } from "@/components/room/RoomActions";
import { InviteCode } from "@/components/room/InviteCode";
import { LastActionNote } from "@/components/room/LastActionNote";
import { PlayIcon } from "@/components/room/player/icons";
import { Chat } from "@/components/room/Chat";

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
const SEEK_STEP_S = 5;

const YT_CONTAINER_ID = "yt-player";
const VIMEO_CONTAINER_ID = "vimeo-player";
const NATIVE_CONTAINER_ID = "native-player";

const CONNECTION_LABEL: Partial<Record<ReturnType<typeof useStatus>, string>> = {
  initial: "conectando...",
  connecting: "conectando...",
  reconnecting: "reconectando...",
  disconnected: "desconectado — tentando religar...",
};

export function RoomExperience({
  roomCode,
  roomName,
  userId,
  userName,
}: {
  roomCode: string;
  roomName: string | null;
  userId: string;
  userName: string;
}) {
  const video = useStorage((root) => root.video);
  const player = useStorage((root) => root.player);
  const othersCount = useOthers((others) => others.length);
  const lastEvent = useLastRoomEvent();
  const status = useStatus();
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  // fica aqui (nível de sala, sempre montado) e não dentro de <Chat> — o
  // aside com o Chat desmonta/remonta ao entrar em fullscreen ou alternar
  // teatro, o que reenviava "entrou na sala" a cada toggle (bug real).
  useRoomJoinAnnouncement(userName);
  // useChat sobe pra este nível (em vez de instanciado dentro de <Chat>)
  // pra existir uma única fonte de mensagens: useRoomLeaveAnnouncement
  // também precisa injetar mensagens de sistema no mesmo feed, e mora aqui
  // pela mesma razão do join acima — instanciar duas vezes duplicaria
  // estado (e o dedup de `appendMessage` é por instância).
  const { messages: chatMessages, sendMessage: sendChatMessage, appendMessage } = useChat({
    userId,
    userName,
  });
  useRoomLeaveAnnouncement(appendMessage, userId);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  // fallback pra onde a Fullscreen API não existe pra elemento comum (Safari
  // no iPhone): o botão simplesmente não fazia nada, sem retorno nenhum
  // (achado 19). Aqui o stage vira `fixed inset-0` e o modo teatro continua
  // funcionando igual.
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || cssFullscreen;
  const [isTheater, setIsTheater] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setNativeFullscreen(active);
      if (!active) setIsTheater(false); // não fica "grudado" ao reentrar depois
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    // o botão de teatro só existe (clicável) em lg+ (docs/specs/03-auditoria-ui-ux/spec.md, seção 10, item
    // 4) — mas isso só fecha a porta de ENTRAR nesse estado por clique. Sem
    // isso aqui, redimensionar a janela pra baixo de lg com teatro já ligado
    // deixava `isTheater` grudado em `true`, reproduzindo o mesmo layout
    // quebrado (aside disputando altura com o vídeo empilhado) por resize
    // em vez de clique.
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (!e.matches) setIsTheater(false);
    };
    onChange(mql);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    const nativeSupported = !!document.fullscreenEnabled && !!stage?.requestFullscreen;
    if (!nativeSupported) {
      setCssFullscreen((v) => {
        if (v) setIsTheater(false);
        return !v;
      });
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      stage?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // identidade estável — RoomExperience re-renderiza a cada evento do
  // Liveblocks (chat, presença, sync); um `() => setLoadModalOpen(false)`
  // inline mudaria de referência a cada um desses renders e re-disparava o
  // efeito de teclado do modal enquanto ele está aberto (docs/specs/03-auditoria-ui-ux/spec.md, seção 10).
  const closeLoadModal = useCallback(() => setLoadModalOpen(false), []);
  const openLoadModal = useCallback(() => setLoadModalOpen(true), []);
  const toggleTheater = useCallback(() => setIsTheater((v) => !v), []);

  const { isReady: youtubeReady, error: youtubeError, controller: youtubeController } =
    useYouTubeSync({ containerId: YT_CONTAINER_ID, userId });
  const { isReady: vimeoReady, error: vimeoError, controller: vimeoController } = useVimeoSync({
    containerId: VIMEO_CONTAINER_ID,
    userId,
  });
  const { isReady: nativeReady, error: nativeError, controller: nativeController } =
    useNativeVideoSync({ containerId: NATIVE_CONTAINER_ID, userId });

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
  const connectionLabel = CONNECTION_LABEL[status];

  // "ao vivo" e o anel de sync saem do player local, não do snapshot cru do
  // storage: ninguém escreve `isPlaying:false` ao fechar a aba, então uma sala
  // reaberta exibia "AO VIVO" com o anel pulsando sobre um vídeo parado
  // (achado 10). Com sync funcionando, estado local == estado da sala.
  const isPlayingNow = activeController?.isPlaying ?? false;

  // se eu for o último a sair, devolvo o storage pra "pausado". Só quando não
  // há mais ninguém: zerar o flag com gente assistindo faria a correção de
  // drift dos outros puxar o vídeo de volta.
  const releasePlayingFlag = useMutation(({ storage }) => {
    const snapshot = storage.get("player");
    if (!snapshot?.isPlaying) return;
    storage.update({ player: { ...snapshot, isPlaying: false, updatedAt: Date.now() } });
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (othersCount > 0) return;
      releasePlayingFlag();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [othersCount, releasePlayingFlag]);

  // Atalhos de teclado do player (achado 27). Ignorados enquanto o foco está
  // num campo de texto ou o modal está aberto — senão espaço/f/m viravam
  // caracteres perdidos no meio de uma mensagem do chat.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        loadModalOpen ||
        (target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable))
      ) {
        return;
      }

      // Sem essa guarda, `preventDefault()` sequestrava Ctrl+F/Cmd+F (busca
      // do browser), Ctrl+K (barra de endereço em alguns browsers) e Cmd+M
      // (minimizar no macOS) — nenhum atalho deste handler tem combinação
      // com modificador, então qualquer tecla com Ctrl/Cmd/Alt não é dele
      // (achado 5, docs/specs/04-auditoria-ui-ux-rodada-2/spec.md).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape" && cssFullscreen) {
        setCssFullscreen(false);
        setIsTheater(false);
        return;
      }
      if (e.key === "f") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (!activeController?.isReady) return;

      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        activeController.togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        activeController.seek(Math.max(activeController.currentTime - SEEK_STEP_S, 0));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        activeController.seek(activeController.currentTime + SEEK_STEP_S);
      } else if (e.key === "m") {
        e.preventDefault();
        activeController.toggleMute();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeController, cssFullscreen, loadModalOpen, toggleFullscreen]);

  // YouTube não tem parâmetro oficial pra desligar a tela de sugestões que
  // desenha por cima ao pausar (ver docs/specs/01-fundacao-mvp/spec.md, seção 7) — cobrimos com um
  // overlay nosso, que também funciona como affordance extra de play.
  const showYoutubePauseOverlay = hasYouTube && youtubeController.isReady && !youtubeController.isPlaying;

  const showAside = !isFullscreen || isTheater;

  return (
    // a página é uma casca de altura fixa em todos os breakpoints: sem isso
    // o vídeo (mesmo com teto de altura) somado ao chat estoura o viewport,
    // o chat nunca chega a ter altura própria pra rolar (o `overflow-y-auto`
    // do `<ul>` em Chat.tsx depende de um ancestral com altura *definida*,
    // não só `min-height`) e é a PÁGINA que rola, levando o player pra fora
    // da tela (achado 9, também reproduzível em lg+ — achado 14).
    // pb-14/max-lg:pb-4 divergem de propósito: respiro pro badge do
    // Liveblocks fixo no canto (docs/specs/01-fundacao-mvp/spec.md, seção 6).
    <main className="mx-auto flex h-dvh w-full max-w-[1800px] flex-col gap-6 overflow-hidden px-6 pt-8 pb-14 max-lg:pb-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/rooms"
            aria-label="voltar para suas salas"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--ink-muted)] text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
          >
            ←
          </Link>
          <div className="flex min-w-0 flex-col">
            {/* papel "Display" da seção 8 do SPEC: título da sala é momento
                grande, não texto de corpo (achado 20). */}
            <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--ink)]">
              {roomName || "sala sem nome"}
            </h1>
            <LastActionNote lastEvent={lastEvent} userId={userId} />
          </div>
          {isPlayingNow && !syncLimited && (
            <span className="shrink-0 rounded-full bg-[var(--invert-bg)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--invert-fg)]">
              ao vivo
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {connectionLabel ? (
            <span role="status" aria-live="polite" className="font-mono text-xs text-[var(--ink-muted)]">
              {connectionLabel}
            </span>
          ) : (
            !syncLimited &&
            !isPlayingNow && (
              <span role="status" aria-live="polite" className="font-mono text-xs text-[var(--ink-muted)]">
                ○ pausado
              </span>
            )
          )}
          <InviteCode code={roomCode} />
        </div>
      </header>

      <div
        ref={stageRef}
        style={
          isFullscreen
            ? ({ padding: FULLSCREEN_PAD, "--fs-pad": FULLSCREEN_PAD } as React.CSSProperties)
            : undefined
        }
        className={`relative flex min-h-0 flex-1 flex-col gap-6 bg-[var(--bg-void)] lg:flex-row ${
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
            showAside ? "lg:basis-[80%]" : "w-full"
          } ${isFullscreen ? "flex-1 justify-center" : "max-lg:shrink-0"}`}
        >
          {isFullscreen && !isTheater && (
            <div className="absolute right-3 top-3 z-20 opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100">
              <RoomActions
                onLoadVideo={openLoadModal}
                onToggleTheater={toggleTheater}
                isTheater={isTheater}
                showTheaterToggle
              />
            </div>
          )}

          {/* o teto de largura mora AQUI, em volta do SyncRing, e não na caixa
              do vídeo: a moldura de sync precisa continuar colada no vídeo
              quando o limite de altura entra em ação, senão a borda passa a
              contornar a coluna inteira com faixas pretas dos dois lados.
              Dois eixos, não só a largura: 38dvh no empilhado (mobile) pra
              sobrar altura real pro chat, e o desconto do chrome da página
              (10rem, ver PAGE_CHROME) no lado a lado — classe literal porque
              o Tailwind não extrai string interpolada (achados 4 e 9). */}
          <div
            className={`w-full ${
              isFullscreen
                ? "mx-auto max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))]"
                : "mx-auto max-w-[min(100%,calc(38dvh*16/9))] lg:max-w-[min(100%,calc((100dvh-10rem)*16/9))]"
            }`}
          >
            <SyncRing
              isPlaying={isPlayingNow}
              source={video?.source ?? null}
              lastEvent={lastEvent}
              isFullscreen={isFullscreen}
            >
              {/* bg-black literal de propósito (não --bg-void): é a letterbox
                  atrás do vídeo, não uma superfície da UI — ver revisão de
                  consistência, achado 5 de docs/specs/04-auditoria-ui-ux-rodada-2/spec.md. */}
              <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
              <PlayerShell
                controller={activeController}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                showFullscreenOnly={hasGeneric}
              >
                {hasYouTube ? (
                  <>
                    <div id={YT_CONTAINER_ID} className="h-full w-full" />
                    {showYoutubePauseOverlay && (
                      <button
                        type="button"
                        onClick={() => youtubeController.play()}
                        aria-label="tocar"
                        // z-20: acima da camada que captura ponteiro sobre o
                        // iframe (z-10 em PlayerShell) e ABAIXO da barra de
                        // controles (z-30) — antes era z-10 e cobria a barra
                        // inteira sempre que o vídeo estava pausado, deixando
                        // tela cheia/scrubber/volume inclicáveis (achado 2).
                        // anel de foco: era `focus:outline-none` sem anel
                        // nenhum, num alvo que ocupa a tela inteira do player
                        // (achado 17). `ring-inset` porque o botão sangra até
                        // a borda da caixa.
                        className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg-void)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--outline-strong)]"
                      >
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--invert-bg)] text-[var(--invert-fg)]">
                          <PlayIcon className="h-7 w-7" />
                        </span>
                      </button>
                    )}
                  </>
                ) : hasVimeo ? (
                  <div id={VIMEO_CONTAINER_ID} className="h-full w-full" />
                ) : hasDirectMedia ? (
                  <NativeVideoPlayer containerId={NATIVE_CONTAINER_ID} />
                ) : hasGeneric ? (
                  <GenericIframe src={video.embedUrl!} />
                ) : storageLoading ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6">
                    <span className="h-2 w-40 rounded-full bg-[var(--line)]" aria-hidden />
                    <span className="h-2 w-24 rounded-full bg-[var(--line)]" aria-hidden />
                    <span className="sr-only" role="status">
                      carregando a sala
                    </span>
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-6 text-center">
                    <p className="text-xl font-semibold tracking-tight text-[var(--ink)]">
                      nenhum vídeo carregado
                    </p>
                    <p className="text-sm text-[var(--ink-muted)]">
                      use &quot;carregar vídeo&quot; ao lado da presença pra começar
                    </p>
                  </div>
                )}
              </PlayerShell>
                <PlayerLoadStatus
                  key={`${video?.embedUrl}-${video?.loadedAt}`}
                  loading={playerLoading}
                  error={playerError}
                  sourceUrl={video?.sourceUrl ?? null}
                />
              </div>
            </SyncRing>
          </div>

          {hasGeneric && isSafeEmbedUrl(video!.embedUrl!) && (
            <p className="text-xs text-[var(--ink-muted)]">
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
          className={`w-full min-h-0 flex-col gap-6 max-lg:flex-1 lg:min-w-72 lg:basis-[20%] ${
            showAside ? "flex" : "hidden"
          } ${
            isFullscreen && isTheater
              ? "rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-4"
              : ""
          }`}
        >
          <section className="flex min-h-0 shrink-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                presença
              </h2>
              <RoomActions
                onLoadVideo={openLoadModal}
                onToggleTheater={toggleTheater}
                isTheater={isTheater}
                showTheaterToggle={isFullscreen}
              />
            </div>
            <PresenceList myName={userName} />
          </section>
          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <Chat userId={userId} messages={chatMessages} sendMessage={sendChatMessage} />
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
    </main>
  );
}
