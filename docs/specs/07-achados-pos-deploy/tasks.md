# Tarefas — achados pós-deploy

Spec: `spec.md` · Pesquisa: `research.md`

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

> Exceção: o item 14.5 (código de sala de 8 → 4 caracteres) segue **aberto**; a tarefa T-005
> registra o que falta.

---

| Tarefa | Estado | Prova |
|---|---|---|
| T-001 altura do chat (14.1) | concluída | reprodução em navegador (3 casos de tela) + gate |
| T-002 anúncio de saída (14.2) | concluída | revisão de código + reprodução com 2 clientes |
| T-003 formato de e-mail (14.3) | concluída | chamada direta a `POST /api/register` |
| T-004 presença colapsável (14.4) | concluída | reprodução em navegador + revisão de a11y |
| T-005 código de sala 8 → 4 (14.5) | **PENDENTE** | `lib/room-code.test.ts` ainda afirma `toHaveLength(8)` |
| T-006 modal em tela cheia (14.6) | concluída | reprodução em tela cheia nativa |
| T-007 legendas do YouTube (14.7) | concluída | reprodução em navegador |
| T-008 gate + verificação (14.8) | concluída | `npm test`, `tsc --noEmit`, `eslint`, `next build` |

---

### T-001 — Altura do chat em todos os breakpoints
**Objetivo:** travar o `main` da sala em altura fixa (`h-dvh overflow-hidden`) em todos os breakpoints,
removendo o prefixo `max-lg:`, e preservar o respiro inferior do badge de presença.
**Arquivos:** `components/room/RoomExperience.tsx`
**Cobre:** FR-001, FR-002, FR-003 / AC-011, AC-012, AC-013
**Prova:** reprodução de ~20 mensagens curtas em `lg+` fora de tela cheia, em tela cheia nativa e no
fallback `cssFullscreen`; gate (`npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build`).

### T-002 — Anúncio de saída da sala
**Objetivo:** criar o hook de saída via `useOthersListener`, com janela anti-flicker (4000 ms), dedupe
por `userId` e emissão só no feed local, montado no nível de `RoomExperience`.
**Arquivos:** `hooks/useRoomLeaveAnnouncement.ts` (novo); `components/room/RoomExperience.tsx`; o
`appendMessage` de `hooks/useChat.ts` é a via de escrita.
**Cobre:** FR-004, FR-005, FR-006, FR-007, FR-008, FR-009 / AC-005, AC-006, AC-007, AC-008, AC-009,
AC-010
**Prova:** revisão do hook + reprodução com 2 clientes (saída simples, F5 dentro da janela, duas abas
da mesma pessoa).

### T-003 — Validação de formato de e-mail
**Objetivo:** trocar `email.includes("@")` por um regex de formato prático no endpoint de cadastro.
**Arquivos:** `app/api/register/route.ts`
**Cobre:** FR-010 / AC-001, AC-002, AC-003, AC-004
**Prova:** chamada direta a `POST /api/register` com `"a@"`, `"@@"`, `"x@y"` e `"a@b.co"`.

### T-004 — Presença colapsável
**Objetivo:** tornar o cabeçalho de presença um botão-resumo ("N na sala" + chevron) que alterna a
lista de nomes, com `aria-expanded`/`aria-controls` e alvo de toque ≥ 44 px.
**Arquivos:** `components/room/PresenceList.tsx`
**Cobre:** FR-011, FR-012, FR-013, FR-014, FR-015 / AC-014, AC-015, AC-016, AC-017, AC-018
**Prova:** reprodução em navegador (colapsar/expandir, teclado) + revisão de a11y.

### T-005 — Código de sala de 8 → 4 caracteres — **PENDENTE**
**Objetivo:** alterar `CODE_LENGTH` de `8` para `4` em `lib/room-code.ts` e atualizar o teste que hoje
afirma comprimento 8.
**Arquivos:** `lib/room-code.ts`; `lib/room-code.test.ts`
**Cobre:** FR-016, FR-017 / AC-019
**Estado:** não implementado (`CODE_LENGTH = 8`). Sem migração de schema.
**Prova:** `npx vitest run lib/room-code.test.ts` após a mudança (hoje ainda espera 8).

### T-006 — Modal de "carregar vídeo" dentro da árvore do palco
**Objetivo:** mover o `<LoadVideoModal>` para dentro da `div` que é `stageRef`, sem portal nem
dependência nova.
**Arquivos:** `components/room/RoomExperience.tsx`
**Cobre:** FR-018, FR-019, FR-020 / AC-020
**Prova:** reprodução em tela cheia nativa acionando "carregar vídeo".

### T-007 — Legendas do YouTube desligadas por padrão
**Objetivo:** declarar `cc_load_policy: 0` nos `playerVars` do YouTube e desativar o módulo `captions`.
**Arquivos:** `hooks/useYouTubeSync.ts`
**Cobre:** FR-021, FR-022 / AC-021
**Prova:** reprodução em navegador com um vídeo cuja preferência iniciaria com legendas ligadas.

### T-008 — Gate e verificação
**Objetivo:** rodar o gate completo e reproduzir em navegador real os itens que exigem observação
(14.1 e 14.6).
**Arquivos:** — (verificação)
**Cobre:** NFR (gate + reprodução em navegador)
**Prova:** `npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build`; 3 casos de tela.
