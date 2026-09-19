# Tarefas — exclusão de sala e limite de chat

Spec: `spec.md` · Plano: `plan.md` · Contrato: `contracts/delete-room.md`

Numeração igual à do plano aprovado (`T-010`+) para os dois documentos não divergirem.
`[P]` = paralelizável (sem dependência entre si).

---

## Estado da execução (2026-09-18)

| Tarefa | Estado | Prova |
|---|---|---|
| T-010 spec.md | concluída | revisão |
| T-011 plan/research/data-model/contracts | concluída | revisão |
| T-012 rota `DELETE` | concluída | `app/api/rooms/[code]/route.test.ts` (11 testes) |
| T-013 `ConfirmDialog` | concluída | `components/DeleteRoomButton.test.tsx` |
| T-014 `DeleteRoomButton` | concluída | idem |
| T-015 integração na lista | concluída | `app/rooms/page.test.tsx` (3 testes) |
| T-016 testes da rota | concluída | 11/11 |
| T-017 teste da lista | concluída | 3/3 |
| T-018 testes do dialog | concluída | 11/11 |
| T-019 `MAX_MESSAGES` 30 | concluída | `hooks/useChat.test.ts` (7 testes) |
| T-020 verificação manual no navegador | **PENDENTE** | exige navegador + banco com dados; não executada |
| T-021 gate + tabela + converge | concluída | `npm run gate` verde; 125 testes em 11 arquivos |

### Divergências entre o planejado e o implementado

1. **`ConfirmDialog` recebeu um prop não previsto: `triggerRef`.** O plano dizia que ele copiaria
   o padrão do `LoadVideoModal`, que captura `document.activeElement` ao abrir para devolver o foco
   ao fechar. O teste de AC-010 falhou justamente aí: **clicar num botão não o foca** (jsdom e
   Safari, por exemplo), então a devolução de foco do FR-014 não aconteceria. Passou a receber o
   ref do gatilho explicitamente, com a captura passiva como fallback. Isto é uma correção do
   padrão que o `LoadVideoModal` ainda usa.
2. **Arquivo de teste com nome diferente do planejado.** `tasks.md` previa
   `components/ConfirmDialog.test.tsx`; o arquivo é `components/DeleteRoomButton.test.tsx`, porque
   os ACs descrevem o fluxo do botão (que é quem monta o dialog) — o nome segue o que ele testa.
3. **`T-017` virou `app/rooms/page.test.tsx`** em vez de um teste do botão isolado: o `AC-008`
   fala da lista renderizada, e a condição de propriedade vive em `app/rooms/page.tsx`.
4. **Origem do "host da requisição" no `FR-011` não estava fixada no spec.** Implementado com
   `req.headers.get("host")` e fallback para `new URL(req.url).host`. Não verificado atrás de proxy
   real.
5. **`Origin` presente mas não interpretável (inclui `null`) responde `403`** — leitura estrita de
   `FR-011` ("host divergente"). Se a intenção for tratar `Origin: null` como ausente, muda.

---

## Artefatos (concluídos antes da implementação)

### T-010 — Escrever o `spec.md`
**Estado:** concluída
**Saída:** `spec.md` com 18 `FR-` e 19 `AC-`. O analyze apontou que `FR-005` (lado cliente do
`200`) não tinha critério da aceite; `AC-019` foi criado e `AC-009` passou a asserir o nome da sala.

### T-011 — Escrever `plan.md`, `research.md`, `data-model.md`, `contracts/`
**Estado:** concluída
**Saída:** os quatro artefatos nesta pasta, com constitution check registrado.

---

## User story: US-3 — ninguém além do dono apaga a sala (`FR-008`..`FR-012`)

### T-012 — Handler `DELETE /api/rooms/[code]`
**Cobre:** FR-008, FR-009, FR-010, FR-011, FR-012
**Depende de:** —
**Inputs:** `app/rooms/[code]/video/route.ts` (formato de `params` assíncrono e de erro),
`lib/auth.ts`, `lib/prisma.ts`, `contracts/delete-room.md`
**Outputs:** `app/api/rooms/[code]/route.ts`
**Aceite:**
- `export async function DELETE(req, { params })` com `const { code } = await params`.
- Ordem: checar `Origin` → sessão → existência da sala → propriedade.
- `prisma.$transaction([roomMember.deleteMany, room.delete])`, nunca `room.delete` sozinho.
- Nenhuma dependência nova; corpo de erro só com `{ error }`.
**Prova:** T-016.

---

## User story: US-1 e US-2 — excluir com confirmação (`FR-001`..`FR-007`, `FR-013`, `FR-014`)

### T-013 — `components/ConfirmDialog.tsx`
**Cobre:** FR-003, FR-013, FR-014
**Depende de:** —
**Inputs:** `components/room/player/LoadVideoModal.tsx` (padrão de a11y a copiar),
`components/room/player/icons.tsx`
**Outputs:** `components/ConfirmDialog.tsx`
**Aceite:**
- Props: `open`, `title`, `description`, `confirmLabel`, `busyLabel`, `busy`, `error`, `onConfirm`, `onClose`.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no título; overlay fecha por `onMouseDown`.
- Trap de Tab, Escape, `triggerRef` devolvendo o foco, `onClose` em ref (não em dep do efeito).
- Não monta nada quando `open` é falso.
**Prova:** T-018.

### T-014 — `components/DeleteRoomButton.tsx`
**Cobre:** FR-004, FR-005, FR-006, FR-007
**Depende de:** T-012 (contrato), T-013 (dialog)
**Inputs:** `ConfirmDialog.tsx`, `contracts/delete-room.md`
**Outputs:** `components/DeleteRoomButton.tsx`
**Aceite:**
- Estado local: `open`, `busy`, `error`.
- `fetch(`/api/rooms/${roomCode}`, { method: "DELETE" })`; erros de rede e status inesperado caem no `catch`/ramo de erro.
- `200` → fecha e `router.refresh()`; `404` → fecha e `router.refresh()` sem erro (FR-007);
  outros status → mantém aberto e mostra `error` da resposta.
- `busy` desabilita as duas ações do modal.
- Botão de gatilho com texto "excluir sala" e `aria-label` distinguindo a sala.
**Prova:** T-018.

### T-015 — Integrar na lista de `/rooms`
**Cobre:** FR-001, FR-002
**Depende de:** T-014
**Inputs:** `app/rooms/page.tsx`
**Outputs:** `app/rooms/page.tsx` (alterado)
**Aceite:**
- `<li>` vira `flex items-center gap-2`; `<Link>` recebe `min-w-0 flex-1`; o botão é irmão do
  `<Link>`, nunca filho.
- O botão só é renderizado quando `room.ownerId === userId`.
- Nenhuma query nova; `ownerId` já vem da consulta de memberships.
**Prova:** T-017.

---

## User story: US-4 — histórico do chat limitado (`FR-015`..`FR-018`)

### T-019 — `MAX_MESSAGES` 200 → 30
**Cobre:** FR-015, FR-016, FR-017, FR-018
**Depende de:** —
**Inputs:** `hooks/useChat.ts`
**Outputs:** `hooks/useChat.ts` (alterado), `hooks/useChat.test.ts` (novo)
**Aceite:**
- Constante `MAX_MESSAGES = 30`; nenhuma outra mudança de comportamento no hook.
- Testes cobrindo: 40 itens → 30 com o mais antigo fora; sistema e chat no mesmo orçamento;
  id descartado aceito de novo; id retido não duplica; conjunto de vistos com 30 entradas.
**Prova:** `npx vitest run hooks/useChat.test.ts`.

---

## Testes

### T-016 — `[P]` Testes do contrato da rota
**Cobre:** AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007
**Depende de:** T-012
**Inputs:** `app/api/rooms/[code]/route.ts`
**Outputs:** `app/api/rooms/[code]/route.test.ts`
**Aceite:** mock de `next-auth` (`getServerSession`) e de `@/lib/prisma`; `params` passado como
`Promise.resolve({ code })`; import relativo (`./route`). Um caso por AC, com o cenário infeliz
primeiro. Assert de que `delete`/`deleteMany` **não** foram chamados nos casos 401/403.
**Prova:** `npx vitest run`.

### T-017 — `[P]` Teste do botão na lista
**Cobre:** AC-008
**Depende de:** T-015
**Inputs:** `components/DeleteRoomButton.tsx`
**Outputs:** `components/DeleteRoomButton.test.tsx` (ou asserção equivalente)
**Aceite:** com uma sala própria e uma de terceiro, existe exatamente um "excluir sala" e ele está
no item próprio.
**Prova:** `npx vitest run`.

### T-018 — `[P]` Testes do dialog e do fluxo de exclusão
**Cobre:** AC-009, AC-010, AC-011, AC-012, AC-013, AC-019
**Depende de:** T-013, T-014
**Inputs:** `components/ConfirmDialog.tsx`, `components/DeleteRoomButton.tsx`
**Outputs:** `components/ConfirmDialog.test.tsx`
**Aceite:** `role="dialog"` + `aria-modal` presentes e foco dentro do painel; Escape fecha e
devolve o foco ao gatilho; 403 mantém aberto com `role="alert"`; ações desabilitadas durante a
requisição; 404 fecha sem alerta; 200 fecha e o item sai da lista.
**Prova:** `npx vitest run`.

---

## Verificação

### T-020 — Verificação manual nomeada do fluxo
**Cobre:** AC-009, AC-010, AC-011, AC-013 (lado humano)
**Depende de:** T-015, T-018
**Procedimento:** `npm run dev`; logar; abrir `/rooms`; confirmar que o botão aparece **só** na sala
própria; abrir o modal; Tab até o fim e confirmar que o foco não escapa; Escape fecha e o foco volta
ao botão; reabrir e confirmar; confirmar que o item sai da lista. Depois, forçar erro (ex.: sessão
de outro usuário em outra aba ou `Origin` divergente) e confirmar que o modal permanece aberto com
a mensagem de erro. Por fim, enviar 40 mensagens no chat de uma sala e confirmar que a lista para
em 30.
**Restrição:** exige navegador e banco com dados — não executável nesta sessão se faltar qualquer
um dos dois. Se não for possível, registrar como pendência explícita, nunca como concluído.
**Prova:** registro no relatório final.

### T-021 — Gate completo, tabela requisito→evidência e converge
**Cobre:** todos
**Depende de:** todas
**Aceite:** `npm run gate` verde; tabela `FR-`/`AC-` → prova; nenhum comportamento não especificado
introduzido.
**Prova:** saída do gate.

---

## Ordem de execução

```
T-012 ─┬─ T-016
       └─ T-014 ─┬─ T-017
T-013 ─┘         └─ T-018
T-019 (independente)
T-015 ── T-017
todas ── T-020 ── T-021
```

Paralelizáveis: T-016, T-017, T-018, T-019 (arquivos disjuntos).
T-012 e T-013 podem começar juntas; T-014 depende das duas.
