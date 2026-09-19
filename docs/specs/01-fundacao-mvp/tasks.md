# Tarefas — Fundação do MVP

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

## T-001 — Skeleton de auth + salas
- **Objetivo:** entregar o app rodando ponta a ponta com cadastro/login, criação de sala e entrada por código, com os modelos persistidos.
- **Arquivos tocados:** `prisma/schema.prisma`, `lib/prisma.ts`, `lib/auth.ts`, `lib/session.ts`, `lib/rooms.ts`, `app/api/register/route.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/rooms/page.tsx`, `app/rooms/new/route.ts`, `app/rooms/[code]/layout.tsx`, `app/rooms/[code]/page.tsx`, `app/rooms/[code]/loading.tsx`, `app/rooms/[code]/not-found.tsx`, `app/not-found.tsx`, `app/error.tsx`, `components/LoginForm.tsx`, `components/RegisterForm.tsx`, `components/CreateRoomForm.tsx`, `components/JoinRoomForm.tsx`, `components/SignOutButton.tsx`, `components/SessionProviderWrapper.tsx`, `proxy.ts`.
- **FR/AC cobertos:** FR-001, FR-004, FR-017, FR-018, FR-019, FR-020, FR-022; AC-001, AC-003, AC-004, AC-021.
- **Prova:** `lib/auth.ts` (normalização `trim().toLowerCase()` + `bcrypt.compare`); `app/rooms/new/route.ts` (redirect 303); `proxy.ts` (guarda `/rooms/**`); `app/rooms/page.test.tsx`, `lib/rate-limit.test.ts`.

## T-002 — Código de sala de 8 caracteres
- **Objetivo:** trocar o `cuid` de 25 caracteres do Prisma por um código de 8 caracteres ditável, com retentativa em colisão e validação de formato.
- **Arquivos tocados:** `lib/room-code.ts`, `app/rooms/new/route.ts`, `prisma/schema.prisma`.
- **FR/AC cobertos:** FR-002, FR-003; AC-002.
- **Prova:** `lib/room-code.test.ts` (alfabeto sem `0/O/1/I/L/U`, tamanho 8, retentativa em `P2002` e fallback após 5 tentativas).

## T-003 — Presença + sync de player (YouTube)
- **Objetivo:** integrar o Liveblocks, definir o storage `video`/`player`, o broadcast `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK`, a correção de drift e a lista de presença — validando o mecanismo de sync só com YouTube antes de generalizar.
- **Arquivos tocados:** `lib/liveblocks.config.ts`, `app/api/liveblocks-auth/route.ts`, `components/RoomLiveblocksProvider.tsx`, `components/room/RoomClient.tsx`, `components/room/RoomExperience.tsx`, `components/room/SyncRing.tsx`, `components/room/PresenceList.tsx`, `hooks/useYouTubeSync.ts`, `hooks/useLastRoomEvent.ts`, `hooks/playerController.ts`, `lib/playback/events.ts`, `lib/youtube-iframe.ts`.
- **FR/AC cobertos:** FR-006 a FR-013, FR-015; AC-011, AC-012, AC-013, AC-014.
- **Prova:** `lib/playback/events.test.ts`, `hooks/playerController.test.ts` (posição esperada/staleness/clamp), `hooks/playerController.test.ts`.

## T-004 — Chat ao vivo
- **Objetivo:** entregar o chat por broadcast `CHAT_MESSAGE`, com histórico só em estado React local e reconstituído a zero para quem entra depois.
- **Arquivos tocados:** `hooks/useChat.ts`, `components/room/Chat.tsx`, `hooks/useRoomJoinAnnouncement.ts`, `hooks/useRoomLeaveAnnouncement.ts`, `components/room/LastActionNote.tsx`.
- **FR/AC cobertos:** FR-016; AC-016.
- **Prova:** `hooks/useChat.test.ts`.

## T-005 — Fontes adicionais (Vimeo, Drive, mídia direta e fallback genérico)
- **Objetivo:** extrair a detecção de fonte para o servidor (`POST /api/resolve-embed`) e cobrir Vimeo (Player SDK), Google Drive (`/preview`), `.mp4`/`.webm`/`.m3u8` (`DIRECT_MEDIA`) e o fallback `GENERIC_IFRAME`.
- **Arquivos tocados:** `lib/video-source.ts`, `app/api/resolve-embed/route.ts`, `hooks/useVimeoSync.ts`, `hooks/useNativeVideoSync.ts`, `components/room/GenericIframe.tsx`, `components/room/NativeVideoPlayer.tsx`, `components/room/PlayerLoadStatus.tsx`.
- **FR/AC cobertos:** FR-023 a FR-031, FR-034; AC-005 a AC-010, AC-020.
- **Prova:** `lib/video-source.test.ts` (YouTube/Vimeo/Drive/`.m3u8`/genérico), `app/rooms/[code]/video/route.ts` (persistência do vídeo resolvido).

## T-006 — Polish de parsing e estados de erro
- **Objetivo:** cobrir formatos variados de URL do YouTube (watch, youtu.be, shorts, com timestamp) e Vimeo, e os estados de erro (link inválido, embed bloqueado, sala inexistente) e de loading.
- **Arquivos tocados:** `lib/video-source.ts`, `components/room/PlayerLoadStatus.tsx`, `components/room/GenericIframe.tsx`, `app/rooms/[code]/not-found.tsx`, `app/rooms/[code]/loading.tsx`.
- **FR/AC cobertos:** FR-024, FR-025, FR-029, FR-030; AC-005, AC-020.
- **Prova:** `lib/video-source.test.ts`.

## T-007 — Robustez do player YouTube/Vimeo (bug de produção)
- **Objetivo:** corrigir o vídeo do YouTube que carregava preto sem erro: timeout/`onerror` no script da IFrame API, `loadedAt` nas dependências do efeito de recriação do player e destruição da ref ao trocar de fonte; além disso, tratar `onError`/`error` dos SDKs.
- **Arquivos tocados:** `lib/youtube-iframe.ts`, `hooks/useYouTubeSync.ts`, `hooks/useVimeoSync.ts`, `hooks/useNativeVideoSync.ts`, `components/room/PlayerLoadStatus.tsx`, `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-011, FR-032, FR-033, FR-034; AC-011, AC-018, AC-019.
- **Prova:** `components/room/PlayerLoadStatus.tsx` (`key = \`${embedUrl}-${loadedAt}\``), `hooks/useYouTubeSync.ts` (deps com `video.loadedAt`, `destroy()` ao trocar de fonte), `lib/youtube-iframe.ts`.

## T-008 — Barra própria de player, camada de captura e fullscreen
- **Objetivo:** esconder o chrome nativo e renderizar um `PlaybackController` comum consumido pela barra própria, montar a camada de captura de ponteiro sobre o player, colocar o fullscreen no `RoomExperience` (alvo: vídeo + aside) e cobrir o iframe do YouTube pausado.
- **Arquivos tocados:** `hooks/playerController.ts`, `hooks/useYouTubeSync.ts`, `hooks/useVimeoSync.ts`, `hooks/useNativeVideoSync.ts`, `components/room/player/PlayerControls.tsx`, `components/room/player/PlayerShell.tsx`, `components/room/player/icons.tsx`, `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-035 a FR-040; AC-012, (US-10, US-11).
- **Prova:** `hooks/playerController.test.ts`; a camada `div absolute inset-0 z-10` só existe quando há `PlaybackController` (`PlayerShell.tsx`).

## T-009 — Direção visual monocromática e piso de qualidade
- **Objetivo:** aplicar a paleta monocromática, a substituição de semântica de estado, os três papéis tipográficos, o anel de sync, o layout 80/20, o modo teatro e a casca de mobile, com o piso de qualidade (contraste AA, foco visível, `prefers-reduced-motion`, alvos de 44px).
- **Arquivos tocados:** `app/globals.css`, `components/room/RoomExperience.tsx`, `components/room/SyncRing.tsx`, `components/room/Chat.tsx`, `components/room/PresenceList.tsx`, `components/room/InviteCode.tsx`, `components/room/player/PlayerControls.tsx`, `components/room/player/icons.tsx`.
- **FR/AC cobertos:** FR-041, FR-042, FR-043 a FR-051; AC-021.
- **Prova:** `app/globals.css` (tokens `--bg-void`/`--ink`/etc.), `components/room/SyncRing.tsx` (três tratamentos estruturais + flash).
