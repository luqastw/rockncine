# Tarefas — consistência de design

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

Spec: `spec.md` · Pesquisa: `research.md`

---

## T-001 — 404 específico de sala renderizável
**Objetivo:** fazer `/rooms/[code]/not-found.tsx` renderizar de verdade.
**Arquivos tocados:** `app/rooms/[code]/layout.tsx`; `app/rooms/[code]/page.tsx`
**Cobre:** FR-001, FR-002 / AC-001, AC-002
**Prova:** reverificado logado via browser real (o HTML de streaming SSR não serve para isso).

## T-002 — Papel Display nos `h1`
**Objetivo:** igualar peso e tracking dos `h1` nas telas de auth e nos 404.
**Arquivos tocados:** `LoginForm`; `RegisterForm`; os dois `not-found`
**Cobre:** FR-003 / AC-003
**Prova:** medição com `getComputedStyle`.

## T-003 — Card de sala com contorno e hover corretos
**Objetivo:** levar o card de "suas salas" ao mesmo contraste/hover dos outros controles.
**Arquivos tocados:** `app/rooms/page.tsx`
**Cobre:** FR-004 / AC-004
**Prova:** leitura de código (medida de contraste 1,36:1 sobre `--bg-void`).

## T-004 — Links inline com anel de foco do projeto
**Objetivo:** igualar os dois links inline aos links equivalentes de `/login`/`/register`.
**Arquivos tocados:** `components/room/RoomExperience.tsx`; `components/room/PlayerLoadStatus.tsx`
**Cobre:** FR-005 / AC-005
**Prova:** leitura de código.

## T-005 — Tokens e polimento de consistência
**Objetivo:** trocar literais repetidos por tokens e fechar as divergências restantes.
**Arquivos tocados:** `app/globals.css`; `components/room/PlayerLoadStatus.tsx`;
`components/room/InviteCode.tsx`; `app/rooms/page.tsx`; `JoinRoomForm`;
`components/room/Chat.tsx`; os 15 arquivos com `ring-offset-[var(--bg-void)]`;
`components/room/RoomExperience.tsx`; `app/api/register/route.ts`; `LoginForm`
**Cobre:** FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014 / AC-006 a AC-014
**Prova:** `npm test` (22/22), `npx tsc --noEmit`, `npx eslint` e `npx next build` sem erro; os
demais itens por leitura de código.

---

## Verificação e limites

- `npm test` (22/22), `npx tsc --noEmit`, `npx eslint` e `npx next build` sem erro.
- Achado 1 reverificado logado via browser real; os demais, por leitura de código.
- Ressalva não decidida: diferença de `text-xs`/`text-sm` entre botões-fantasma dentro e fora da
  sala (registrada como defensável, não alterada).
