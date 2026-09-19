# Tarefas — code review (autorização, injeção e bugs funcionais)

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

Spec: `spec.md` · Pesquisa: `research.md`

---

## T-001 — Fechar o bypass de autorização na busca de sala
**Objetivo:** parar de resolver a sala por curinga (`%`/`_`) e não conceder acesso a quem não tem o
código.
**Arquivos tocados:** `lib/rooms.ts`; `app/rooms/[code]/layout.tsx`; `app/rooms/[code]/page.tsx`
**Cobre:** FR-001, FR-002 / AC-001, AC-002, AC-003, AC-004
**Prova:** query real contra o Postgres de dev — `%`, `A%` e `_` não casam mais nenhuma sala;
`ABCD2345` e `abcd2345` resolvem a mesma sala.

## T-002 — Fechar a injeção de `embedUrl` em duas camadas
**Objetivo:** não aceitar `source`/`embedUrl` do client no PATCH e recusar URL não `http(s)` na
renderização.
**Arquivos tocados:** `app/rooms/[code]/video/route.ts`; `lib/video-source.ts`;
`components/room/GenericIframe.tsx`; `components/room/RoomExperience.tsx`;
`components/room/PlayerLoadStatus.tsx`
**Cobre:** FR-003, FR-004 / AC-005, AC-006, AC-007
**Prova:** leitura/inspeção — o PATCH re-deriva o vídeo no servidor; `isSafeEmbedUrl` guarda os três
pontos de renderização.

## T-003 — Overlay de erro alcançável e a regressão de `AbortError`
**Objetivo:** manter o overlay vivo enquanto houver erro, ignorar `AbortError` e limpar o erro quando
a reprodução volta; refazer o load quando o atalho de retry não se aplica.
**Arquivos tocados:** `components/room/PlayerLoadStatus.tsx`; `hooks/useNativeVideoSync.ts`
**Cobre:** FR-005, FR-006, FR-007, FR-008 / AC-008, AC-009, AC-010, AC-011
**Prova:** `npm test` (22/22), `npx tsc --noEmit` e `npx eslint` sem erro.

## T-004 — Entregar o anúncio "entrou na sala"
**Objetivo:** enfileirar o broadcast emitido antes de o socket conectar.
**Arquivos tocados:** `hooks/useRoomJoinAnnouncement.ts`
**Cobre:** FR-009 / AC-012
**Prova:** verificação contra o código do SDK instalado (`{ shouldQueueEventIfNotReady: true }`).

## T-005 — Guarda de modificadores nos atalhos
**Objetivo:** parar de sequestrar Ctrl+F/Cmd+F/Ctrl+K/Cmd+M.
**Arquivos tocados:** `components/room/RoomExperience.tsx`
**Cobre:** FR-010 / AC-013, AC-014
**Prova:** leitura de código.

## T-006 — Deduplicar o broadcast do seek no Vimeo
**Objetivo:** não emitir `commit`/`broadcast` em duplicidade a cada seek local.
**Arquivos tocados:** `hooks/useVimeoSync.ts`
**Cobre:** FR-011 / AC-015
**Prova:** leitura de código; comentário desatualizado removido.

## T-007 — Cobertura de testes (Vitest)
**Objetivo:** cobrir as três categorias de risco que motivaram a revisão.
**Arquivos tocados:** `lib/video-source.test.ts`; `hooks/playerController.test.ts`;
`lib/room-code.test.ts`; `package.json`
**Cobre:** FR-012 / AC-016
**Prova:** `npm test` — 22 testes, todos passando.

---

## Verificação e limites

- `npm test` (22/22), `npx tsc --noEmit` e `npx eslint` sem erro depois de cada rodada.
- Achado 1 reverificado com query real contra o Postgres de dev antes e depois da correção.
- A segunda rodada confirmou as 6 correções da primeira como sólidas e achou os 3 bugs novos
  (12.2.A/B/C), nenhum de segurança.
