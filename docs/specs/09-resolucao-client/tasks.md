# Tarefas — resolução client-side, FPS e modo economy

Spec: `spec.md` · Pesquisa: `research.md` · Plano de execução legado (verbatim): `research-tasks.md`

Reconstrução histórica — o trabalho já foi implementado; não é um plano a executar.

> A numeração abaixo (`T-001`…) é a reconstruída no formato SDD. O plano original (decisões A1–A5 e
> tarefas T1–T13) permanece íntegro em `research-tasks.md`.

---

## Decisões de arquitetura (histórico, preservado)

- **A1.** Hook `useVideoQuality` centraliza resolução, FPS, economy e a heurística; estado passado por
  props a `PlayerShell` → `PlayerControls`.
- **A2.** Resolução HLS recalculada em runtime: a prop `targetResolution` recalcula `autoLevelCapping`
  no `MANIFEST_PARSED` e aplica via `hls.currentLevel` se o manifest já carregou.
- **A3.** Resolução Vimeo via `player.setQuality(...)`, erro tratado em silêncio.
- **A4.** FPS: "Automático" = sem intervenção; "30fps" via `hls.maxMaxBufferLength`; YouTube/Vimeo sem
  controle; seletor oculto em mobile.
- **A5.** Modo economy controlado pelo hook; SyncRing sem pulso, chat inalterado, throttle do
  Liveblocks 80 → 500 ms, badge "Economy" no header.

---

| Tarefa | Estado | Prova |
|---|---|---|
| T-001 hook `useVideoQuality` | concluída | `hooks/useVideoQuality.test.ts` |
| T-002 `PlaybackController` com resolução/FPS | concluída | revisão (`hooks/playerController.ts`) |
| T-003 resolução em `useNativeVideoSync` (HLS) | concluída | revisão + reprodução |
| T-004 resolução em `useVimeoSync` | concluída | revisão |
| T-005 resolução em `useYouTubeSync` (null) | concluída | revisão |
| T-006 resolução no controller genérico (null) | concluída | revisão |
| T-007 botão de resolução em `PlayerControls` | concluída | revisão |
| T-008 `PlayerShell` repassa resolução | concluída | revisão |
| T-009 economy: `SyncRing` | concluída | revisão |
| T-010 economy: throttle do Liveblocks | concluída | revisão |
| T-011 economy: badge + integração | concluída | revisão |
| T-012 detecção automática: `EconomySuggestion` | concluída | revisão |
| T-013 testes unitários | concluída | `npx vitest run hooks/useVideoQuality.test.ts` |

---

### T-001 — Hook `useVideoQuality`
**Objetivo:** criar o hook com `resolution`, `fpsLimit` e `economyMode`, persistência em
`localStorage` e a heurística `detectLowEndDevice()` / detecção de Safari.
**Arquivos:** `hooks/useVideoQuality.ts` (novo)
**Cobre:** FR-008, FR-014, FR-018, FR-021, FR-022, FR-023, FR-024, FR-025 / AC-011, AC-014, AC-019,
AC-022, AC-023, AC-024, AC-025, AC-026, AC-027
**Prova:** `hooks/useVideoQuality.test.ts`.

### T-002 — Estender `PlaybackController` com resolução/FPS
**Objetivo:** adicionar `resolution` (`null` = fonte sem suporte), `setResolution?`, `fpsLimit` e
`setFpsLimit?` ao tipo do controller.
**Arquivos:** `hooks/playerController.ts`
**Cobre:** FR-004, FR-005
**Prova:** revisão de tipo (`npx tsc --noEmit`).

### T-003 — Resolução no `useNativeVideoSync` (HLS)
**Objetivo:** adicionar `targetResolution`/`fpsLimit`; calcular o cap no `MANIFEST_PARSED` e reaplicar
em runtime; Safari → `resolution = null`.
**Arquivos:** `hooks/useNativeVideoSync.ts`
**Cobre:** FR-004, FR-009, FR-010, FR-013 / AC-002, AC-003, AC-004, AC-007, AC-012
**Prova:** revisão + reprodução (troca de resolução sem restart).

### T-004 — Resolução no `useVimeoSync`
**Objetivo:** chamar `player.setQuality("480p" | "720p")` na mudança de resolução, erro silencioso.
**Arquivos:** `hooks/useVimeoSync.ts`
**Cobre:** FR-005, FR-009 / AC-001, AC-004
**Prova:** revisão.

### T-005 — Resolução no `useYouTubeSync`
**Objetivo:** retornar `resolution: null` e `setResolution: undefined` (API sem controle de qualidade).
**Arquivos:** `hooks/useYouTubeSync.ts`
**Cobre:** FR-006 / AC-005
**Prova:** revisão.

### T-006 — Resolução no controller genérico
**Objetivo:** para `.mp4`/`.webm` e iframe genérico, retornar `resolution: null`.
**Arquivos:** `hooks/playerController.ts` (ou auxiliar)
**Cobre:** FR-007 / AC-006
**Prova:** revisão.

### T-007 — Botão de resolução em `PlayerControls`
**Objetivo:** inserir o botão entre volume e fullscreen, com texto da resolução atual e dica quando
desabilitado (YouTube, `.mp4`/`.webm`, Safari).
**Arquivos:** `components/room/player/PlayerControls.tsx`
**Cobre:** FR-001, FR-002, FR-003, FR-006, FR-007 / AC-005, AC-006, AC-008, AC-009, AC-010
**Prova:** revisão + reprodução.

### T-008 — `PlayerShell` repassa a resolução
**Objetivo:** adicionar `resolution` e `onToggleResolution` e repassar ao `PlayerControls`.
**Arquivos:** `components/room/player/PlayerShell.tsx`
**Cobre:** FR-001 / AC-008
**Prova:** revisão.

### T-009 — Modo economy: `SyncRing`
**Objetivo:** com `economyMode`, remover `animate-sync-pulse` (mantendo o flash de evento).
**Arquivos:** `components/room/SyncRing.tsx`
**Cobre:** FR-017 / AC-017
**Prova:** revisão.

### T-010 — Modo economy: throttle do Liveblocks
**Objetivo:** `throttle = economyMode ? 500 : 80`.
**Arquivos:** `components/RoomLiveblocksProvider.tsx`
**Cobre:** FR-017 / AC-017
**Prova:** revisão.

### T-011 — Modo economy: badge + integração
**Objetivo:** chamar `useVideoQuality()` no `RoomExperience`, forçar 480p quando economy está ativo,
renderizar o badge "Economy", integrar o toggle e repassar props.
**Arquivos:** `components/room/RoomExperience.tsx`
**Cobre:** FR-016, FR-018, FR-019, FR-020 / AC-017, AC-018, AC-020, AC-021
**Prova:** revisão + reprodução.

### T-012 — Detecção automática: `EconomySuggestion`
**Objetivo:** toast quando `isLowEnd && !já_decidiu`, com "Sim" (ativa economy + 480p) e "Agora não"
(registra a recusa).
**Arquivos:** `components/room/EconomySuggestion.tsx` (novo)
**Cobre:** FR-022, FR-023, FR-024 / AC-024, AC-025, AC-026
**Prova:** reprodução (mock de `hardwareConcurrency`).

### T-013 — Testes unitários
**Objetivo:** cobrir persistência, heurística, ciclo de resolução, economy forçando 480p e detecção de
Safari.
**Arquivos:** `hooks/useVideoQuality.test.ts` (novo)
**Cobre:** todos os FR / AC-010, AC-011, AC-014, AC-019, AC-022, AC-023, AC-025, AC-026, AC-027
**Prova:** `npx vitest run hooks/useVideoQuality.test.ts`.

---

## Ordem de execução (histórica)

```
T-001 (hook) → T-002 (interface) → T-003/T-004/T-005/T-006 (hooks de sync) → T-007/T-008 (UI player)
                                                       → T-009/T-010/T-011 (economy) → T-012 → T-013
```
