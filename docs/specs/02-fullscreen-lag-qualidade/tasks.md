# Tarefas — Tela cheia, lag e teto de qualidade

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

## T-001 — Layout de tela cheia centrado, com respiro
- **Objetivo:** dar o respiro pelo próprio elemento fullscreen e limitar a caixa do vídeo pelos dois eixos.
- **Arquivos tocados:** `components/room/RoomExperience.tsx`, `app/globals.css`.
- **FR/AC cobertos:** FR-001 a FR-005; AC-001, AC-002, AC-003.
- **Prova:** `RoomExperience.tsx:32` (constante `FULLSCREEN_PAD = "clamp(0.75rem,2.5vmin,2.5rem)"` usada no padding do stage e no `max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))]`).

## T-002 — Reposicionar o botão de "modo teatro"
- **Objetivo:** transformar o par `carregar vídeo` + `teatro` num componente único, com a âncora variando conforme o estado de tela cheia.
- **Arquivos tocados:** `components/room/RoomActions.tsx`, `components/room/RoomExperience.tsx`, `components/room/player/PlayerShell.tsx`.
- **FR/AC cobertos:** FR-006 a FR-012; AC-004 a AC-009.
- **Prova:** `components/room/RoomActions.tsx:17` (comentário do componente citando a decisão), `components/room/player/PlayerShell.tsx:34` (barra mínima como porta ao modo teatro).

## T-003 — Correção das causas de lag confirmadas
- **Objetivo:** remover a animação de `border-width` do anel, tirar `currentTime`/`duration` do caminho de render compartilhado e trocar o estado escondido da barra (sem `visibility:hidden`, sem `backdrop-blur`).
- **Arquivos tocados:** `app/globals.css`, `components/room/RoomExperience.tsx`, `components/room/player/PlayerShell.tsx`, `components/room/player/PlayerControls.tsx`, `components/room/Chat.tsx`, `components/room/PresenceList.tsx`, `hooks/useYouTubeSync.ts`, `hooks/useVimeoSync.ts`, `hooks/useNativeVideoSync.ts`.
- **FR/AC cobertos:** FR-013, FR-014, FR-015; AC-010, AC-011.
- **Prova:** `app/globals.css` (`animate-sync-pulse` como `box-shadow` estático, sem keyframe de largura), `components/room/player/PlayerShell.tsx:115` (comentário do estado escondido).

## T-004 — Teto de 720p por fonte
- **Objetivo:** aplicar `max_quality`/`setQuality` no Vimeo e `autoLevelCapping` no HLS; não emitir chamada de qualidade no YouTube nem no `.mp4`/`.webm`.
- **Arquivos tocados:** `hooks/useVimeoSync.ts`, `hooks/useNativeVideoSync.ts`, `hooks/useVideoQuality.ts`, `hooks/useVideoQuality.test.ts`.
- **FR/AC cobertos:** FR-016 a FR-020; AC-012 a AC-015.
- **Prova:** `hooks/useVideoQuality.test.ts`; `hooks/useVimeoSync.ts:36` e `:191` (comentários do teto Vimeo); `hooks/useNativeVideoSync.ts:131` (comentário do `autoLevelCapping`).

## T-005 — Addendum: moldura em tela cheia e chat que zerava
- **Objetivo:** desligar a moldura do `SyncRing` em tela cheia e manter o `<aside>` sempre montado para o chat não perder o histórico.
- **Arquivos tocados:** `components/room/SyncRing.tsx`, `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-021, FR-022, FR-023; AC-016, AC-017.
- **Prova:** `components/room/SyncRing.tsx:27` (prop `isFullscreen`, `showChrome = !isFullscreen`), `components/room/RoomExperience.tsx:530` (comentário "sempre montado, nunca condicionalmente renderizado").

## T-006 — Tela cheia e teatro em `GENERIC_IFRAME`
- **Objetivo:** renderizar só o botão de tela cheia na barra mínima quando não há controller, mantendo-o sempre visível.
- **Arquivos tocados:** `components/room/player/PlayerShell.tsx`, `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-024, FR-025, FR-026; AC-018, AC-019, AC-020.
- **Prova:** `components/room/player/PlayerShell.tsx` (prop `showFullscreenOnly` / `alwaysVisible`).
