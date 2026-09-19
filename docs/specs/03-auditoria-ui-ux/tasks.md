# Tarefas — Auditoria UI/UX

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

## T-001 — Alvos de toque ≥ 44px
- **Objetivo:** subir os controles abaixo do piso de 44px de spec 01, seção 8, incluindo a área de toque do scrubber/volume.
- **Arquivos tocados:** `components/room/player/PlayerControls.tsx`, `components/room/RoomActions.tsx`, `components/room/Chat.tsx`, `components/room/player/LoadVideoModal.tsx`.
- **FR/AC cobertos:** FR-001, FR-002, FR-003; AC-001, AC-002.
- **Prova:** `PlayerControls.tsx` (`h-11 w-11` nos botões; `content-box` + `py-5` no scrubber/volume); `RoomActions.tsx` (`min-h-11`/`h-11 w-11`); `Chat.tsx` (`flex-wrap` na fileira de emojis).

## T-002 — Contraste de `--ink-muted` (achado 2)
- **Objetivo:** subir `--gray-500` de `#7A7A7A` para `#828282`, atingindo AA sobre `--bg-surface` e `--bg-void`.
- **Arquivos tocados:** `app/globals.css`.
- **FR/AC cobertos:** FR-004; AC-003.
- **Prova:** `app/globals.css` (`--gray-500: #828282;`).

## T-003 — Semântica de dialog, trap e devolução de foco (achado 3)
- **Objetivo:** dar `role="dialog"`/`aria-modal`/`aria-labelledby` ao modal, prender o foco no painel e devolvê-lo ao gatilho ao fechar.
- **Arquivos tocados:** `components/room/player/LoadVideoModal.tsx`.
- **FR/AC cobertos:** FR-005; AC-004, AC-005.
- **Prova:** `components/room/player/LoadVideoModal.tsx` (`role="dialog"`, `panelRef`, `triggerRef`).

## T-004 — Fullscreen + teatro abaixo de `lg` (achado 4)
- **Objetivo:** fechar a porta de entrada no estado inválido com o botão de teatro restrito a `lg`.
- **Arquivos tocados:** `components/room/RoomActions.tsx`, `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-006; AC-006.
- **Prova:** `components/room/RoomActions.tsx:66` (comentário "escondido abaixo de lg") e `className="hidden ... lg:flex"`.

## T-005 — Estado vazio do player em "Display" (achado 5)
- **Objetivo:** reescrever o placeholder de vídeo-não-carregado como estado intencional (título Display + instrução de corpo).
- **Arquivos tocados:** `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-008; AC-008.
- **Prova:** `components/room/RoomExperience.tsx:331` (comentário do papel "Display") e as classes `text-xl font-semibold tracking-tight`.

## T-006 — `aria-live` no chat (achado 6)
- **Objetivo:** anunciar mensagens novas a leitores de tela sem re-anunciar o histórico.
- **Arquivos tocados:** `components/room/Chat.tsx`.
- **FR/AC cobertos:** FR-009; AC-009.
- **Prova:** `components/room/Chat.tsx` (`role="log"`, `aria-live="polite"`, `aria-relevant="additions"`).

## T-007 — Contorno de affordance de botão (achado 7)
- **Objetivo:** trocar a borda `--line` por `--ink-muted` nos botões cuja única affordance é a borda sobre `--bg-void`, mantendo `--line` para divisores decorativos.
- **Arquivos tocados:** `components/room/RoomActions.tsx`, `components/room/player/PlayerControls.tsx`, `components/room/player/PlayerShell.tsx`.
- **FR/AC cobertos:** FR-010; AC-010.
- **Prova:** `components/room/RoomActions.tsx` (`border-[var(--ink-muted)]`).

## T-008 — Emojis de reação avaliados-e-mantidos (achado 9)
- **Objetivo:** registrar que o conjunto ❤️💔🔥😢🐔🍲 foi sinalizado e mantido por decisão do usuário.
- **Arquivos tocados:** `components/room/Chat.tsx` (inalterado).
- **FR/AC cobertos:** FR-013; AC-012.
- **Prova:** ausência de mudança no conjunto de emojis.

## T-009 — Corrigir `onClose` inline re-disparando o efeito de teclado (addendum 10.1-A)
- **Objetivo:** dar identidade estável ao `onClose` e desacoplar o efeito de teclado (e o de foco/erro) do `onClose`.
- **Arquivos tocados:** `components/room/RoomExperience.tsx`, `components/room/player/LoadVideoModal.tsx`.
- **FR/AC cobertos:** FR-011, FR-012; AC-011.
- **Prova:** `components/room/RoomExperience.tsx:158` (comentário do `useCallback` estável) e `LoadVideoModal.tsx` (`onCloseRef`, efeito de `keydown` com deps `[open]`).

## T-010 — Bloquear o resize que reproduz o layout quebrado (addendum 10.1-B)
- **Objetivo:** forçar `isTheater = false` quando a viewport cruza para abaixo de `lg`, mesmo com teatro já ligado.
- **Arquivos tocados:** `components/room/RoomExperience.tsx`.
- **FR/AC cobertos:** FR-007; AC-007.
- **Prova:** `components/room/RoomExperience.tsx:123` (comentário do guard de resize) e o efeito de `matchMedia("(min-width: 1024px)")`.
