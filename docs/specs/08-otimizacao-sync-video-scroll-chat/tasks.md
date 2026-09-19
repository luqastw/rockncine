# Tarefas — otimização de sincronização de vídeo e scroll do chat

Spec: `spec.md` · Pesquisa: `research.md`

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

> Exceção parcial: o CA1.2 (FR-004) foi atendido só em parte — o cooldown do YouTube mudou de duração
> (400 → 1500 ms) mas continua sendo timeout fixo, não resolução por evento. A tarefa T-002 registra
> esse recorte.

---

| Tarefa | Estado | Prova |
|---|---|---|
| T-001 tolerâncias de drift adaptativas | concluída | `hooks/playerController.test.ts` (relações) |
| T-002 cooldown do YouTube por evento | **PARCIAL** | cooldown 1500 ms (fallback) em `hooks/playerController.ts` |
| T-003 testes dos thresholds | concluída | `npx vitest run hooks/playerController.test.ts` |
| T-004 barra de scroll invisível no chat | concluída | `app/globals.css` + `components/room/Chat.tsx` |
| T-005 scroll preservado e restrito ao chat | concluída | reprodução manual (wheel/trackpad/teclado) |

---

### T-001 — Tolerâncias de drift adaptativas por tipo de player
**Objetivo:** separar a tolerância de drift do `<video>` nativo da do YouTube (YouTube ≥ 2× nativo) e
preservar o limiar de 2 s para o dono da última ação com o player pausado.
**Arquivos:** `hooks/playerController.ts`, `hooks/useYouTubeSync.ts`, `hooks/useNativeVideoSync.ts`
**Cobre:** FR-001, FR-002, FR-003 / AC-001, AC-002, AC-003, AC-004, AC-005
**Prova:** `hooks/playerController.test.ts` assere a relação (`YOUTUBE ≥ 2 × NATIVE`) e a faixa em
segundos.

### T-002 — Cooldown do YouTube por evento (CA1.2) — **PARCIAL**
**Objetivo:** liberar o flag de guarda quando o seek remoto no YouTube de fato completa (por
Promise/evento), em vez de por timeout fixo.
**Arquivos:** `hooks/useYouTubeSync.ts`, `hooks/playerController.ts`
**Cobre:** FR-004 / AC-006, AC-007
**Estado:** parcial — o cooldown passou de 400 ms para 1500 ms (`REMOTE_APPLY_COOLDOWN_MS`), mas segue
sendo timeout fixo de fallback; a resolução por evento (AC-006) não foi implementada.
**Prova:** leitura do código + teste existente que garante `REMOTE_APPLY_COOLDOWN_MS < CHECK_INTERVAL_MS`.

### T-003 — Testes das tolerâncias
**Objetivo:** cobrir em teste unitário as relações entre as tolerâncias e o cooldown.
**Arquivos:** `hooks/playerController.test.ts`
**Cobre:** CA1.5 → NFR (cobertura de teste)
**Prova:** `npx vitest run hooks/playerController.test.ts`.

### T-004 — Barra de scroll invisível no chat
**Objetivo:** aplicar `scrollbar-width: none` (Firefox) e `::-webkit-scrollbar { display: none }`
(Chrome/Safari) apenas ao chat.
**Arquivos:** `app/globals.css` (classe `.scrollbar-hidden`), `components/room/Chat.tsx`
**Cobre:** FR-005, FR-008 / AC-008, AC-009, AC-013
**Prova:** inspeção de CSS + reprodução em Firefox, Chrome e Safari.

### T-005 — Scroll preservado e restrito ao chat
**Objetivo:** manter o scroll por wheel/trackpad/teclado, o auto-scroll ao enviar e o botão "novas
mensagens ↓", sem afetar PresenceList e stage.
**Arquivos:** `components/room/Chat.tsx`
**Cobre:** FR-006, FR-007 / AC-010, AC-011, AC-012
**Prova:** reprodução manual (scroll, envio de mensagem, botão "novas mensagens ↓").
