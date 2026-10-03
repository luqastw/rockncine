# Tarefas: chat da sala

Ordem executada em 2026-10-03. `npm run gate` é o portão de saída de cada onda; estado final do gate
na última onda: typecheck, lint, 379 testes e build OK.

## Onda 1 — isolamento, custo por tecla e envio confiável

- [x] **T-001** — `lib/chat-feed.ts`: store do feed (append com dedupe, teto de 30, inserção
  ordenada por `ts` com estabilidade para empate, snapshot estável, subscribe, reset).
  Cobre FR-001, FR-003, FR-004, FR-007. Prova: `lib/chat-feed.test.ts` (AC-004, AC-006, AC-007).
- [x] **T-002** — `hooks/useChatFeed.ts`: assinatura da store com `useSyncExternalStore`.
  Cobre FR-001. Prova: T-007.
- [x] **T-003** — `hooks/useChat.ts`: emissor sem estado; fila local de envio com despejo no
  `connected` (não `shouldQueueEventIfNotReady` — ver divergência na spec); contrato
  `{ sendMessage, appendMessage }` (FR-008).
  Cobre FR-005, FR-008. Prova: `hooks/useChat.test.tsx` (AC-005).
- [x] **T-004** — `hooks/useRoomLeaveAnnouncement.ts` + `components/room/RoomExperience.tsx`:
  `useChat` saiu do nível da sala; store no lugar; reset no mount da sala.
  Cobre FR-002, FR-007. Prova: T-007.
- [x] **T-005** — `lib/identity.ts` + `--id-1..4` em `app/globals.css`: iniciais e tom.
  Cobre FR-018. Prova: `lib/identity.test.ts` (AC-014) e contraste medido na NFR.
- [x] **T-006** — `components/room/Chat.tsx`: reescrita do log (`Intl` único em módulo, item
  memoizado, agrupamento por autor, divisória de dia, divisória de não lidas, bolha da própria
  mensagem, sombra de "há conteúdo acima", rolagem suave com `prefers-reduced-motion`, aviso de
  envio em fila). Cobre FR-002, FR-009 a FR-022. Prova: `components/room/Chat.test.tsx`.
- [x] **T-007** — contador de renders: bloco novo em `components/room/RoomExperience.test.tsx`, com o
  `Chat` real e a presença substituída por contador. Cobre FR-002, FR-011 (AC-001, AC-003).
- [x] **T-008** — composer em `textarea` com auto-resize até 4 linhas, Enter envia / Shift+Enter
  quebra, IME preservado, contador a partir de 80% do limite, aviso de corte, emoji na posição do
  cursor com envio imediato quando o campo é só o emoji, `scrollIntoView` no foco.
  Cobre FR-023 a FR-028. Prova: `Chat.test.tsx` (AC-018 a AC-024).
- [x] **T-009** — `memo` nos blocos de prop estável: `RoomActions`, `SyncRing`, `InviteCode`,
  itens do log. `PlayerShell`/`PlayerControls` fora, com motivo registrado na spec (seção 8).
  Cobre FR-010. Prova: gate + revisão do diff.
- [x] **T-010** — `README.md` e `docs/specs/README.md`: entrada da spec 13 e descrição do chat.
  Prova: leitura.
- [x] **T-018** — fila de envio própria, depois de a auditoria achar que o
  `shouldQueueEventIfNotReady` é opção declarada instável pelo Liveblocks. Cobre FR-005.
  Prova: `hooks/useChat.test.tsx` (AC-005 reescrito para o despejo).

## Onda 2 — leitura do log e presença

- [x] **T-011** — `components/room/PresenceList.tsx`: gatilho e lista viram componentes separados com
  estado elevado (`usePresenceDisclosure`), sem cabeçalho próprio. Cobre FR-021 (parcial, declarado).
  Prova: `RoomExperience.test.tsx` + AC-016 por revisão de markup (o arquivo não tem suíte própria).
- [x] **T-012** — `components/room/RoomExperience.tsx`: cabeçalho único de presença (gatilho + ações),
  `<h2>presença</h2>` removido. Cobre FR-021. Prova: AC-016.
- [x] **T-013** — `components/room/IdentityChip.tsx`: identidade aplicada à lista de presença e ao
  cabeçalho da fala (componente único, sem cópia entre os dois lugares). Cobre FR-018.
  Prova: `lib/identity.test.ts` + AC-014.
- [x] **T-014** — texto acessível por item: autor/horário em `sr-only` nos itens agrupados, prefixo
  "aviso da sala" nas mensagens de sistema. Cobre FR-022. Prova: AC-017.

## Onda 4 — correções da própria auditoria

- [x] **T-019** — fila de envio substitui `shouldQueueEventIfNotReady` (opção que o Liveblocks
  documenta como instável). Cobre FR-005. Prova: `hooks/useChat.test.tsx` (AC-005).
- [x] **T-020** — árvore de anúncios do log limpa: divisórias `aria-hidden`, indicador de digitação
  `aria-live="off"`. Cobre FR-022, FR-030. Prova: `Chat.test.tsx` (AC-029).
- [x] **T-021** — `memo` no `Chat` (props são strings) e auto-resize que nunca fixa altura 0.
  Cobre FR-010, FR-023. Prova: gate + AC-003.
- [x] **T-022** — dedupe entre envio otimista e eco do servidor. Cobre FR-005. Prova:
  `hooks/useChat.test.tsx` (AC-028).

**Lacunas que sobraram, e por quê** (a spec 13, seção 8, detalha): duas abas reais, navegador de
verdade (rolagem suave, altura, teclado virtual) e leitor de tela. Não há como fechar nenhuma delas
por teste neste repositório — exigem device ou socket.

## Onda 3 — digitação, emoji e altura

- [x] **T-015** — `liveblocks.config.ts`: `typing` opcional na presence. Cobre FR-029.
  Prova: `Chat.test.tsx` (AC-026).
- [x] **T-016** — indicador de digitação no log: uma linha, uma vez por pessoa, presence escrita
  uma vez e desligada por ociosidade de 1,2 s (e na hora do envio). Cobre FR-029, FR-030.
  Prova: AC-026, AC-027.
- [x] **T-017** — popover de emoji no lugar da fileira fixa: foco no primeiro emoji ao abrir, Escape
  fecha e devolve o foco, clique fora fecha, abre para cima (nunca empurra o composer).
  Cobre a NFR de altura. Prova: teste do popover em `Chat.test.tsx`.
  **Verificação manual pendente:** a constante `22rem` do cálculo de altura do vídeo não foi
  alterada (decisão na spec, seção 8), então a medição de altura do painel em 320×700 e 1440×900
  continua manual, sem automação neste repositório.