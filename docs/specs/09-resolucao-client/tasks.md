# Tarefas — Otimização para PCs fracos

Spec: `docs/specs/09-resolucao-client/spec.md`

**Estado:** todas implementadas

---

## Decisões de arquitetura

### A1. Estado de qualidade: hook `useVideoQuality`
Criar um hook `hooks/useVideoQuality.ts` que encapsula:
- `resolution: "720p" | "480p"` (padrão: "720p")
- `fpsLimit: "auto" | "30" | "60"` (padrão: "auto")
- `economyMode: boolean` (padrão: false)
- Persistência em localStorage com chave `rockncine-video-quality`
- Funções `setResolution()`, `setFpsLimit()`, `setEconomyMode()`
- Heurística de detecção de dispositivo fraco (CA-4.1 a CA-4.5)

O hook é chamado em `RoomExperience` e o state é passado via props ao `PlayerShell` → `PlayerControls`.

### A2. Mudança de resolução HLS em runtime
`useNativeVideoSync` não expõe `hlsRef`. Solução: adicionar prop `targetResolution` ao hook.
Quando `targetResolution` mudar, o hook recalcula `autoLevelCapping` no `MANIFEST_PARSED`
e também aplica imediatamente via `hls.levels` + `hls.currentLevel` se o manifesto já foi carregado.

**Risco (CA-1.4):** `autoLevelCapping` dinâmico pode não ser suportado em runtime. Fallback:
se o cap não resolver, forçar `hls.currentLevel` (perde ABR mas garante resolução).

### A3. Mudança de resolução Vimeo em runtime
`useVimeoSync` já tem `capQuality()`. Adicionar prop `targetResolution` que chama
`player.setQuality('480p')` ou `player.setQuality('720p')` diretamente. Tratar erro
silenciosamente (plano gratuito pode não ter 480p).

### A4. FPS: simplificação
A limitação real de FPS via `requestVideoFrameCallback` não é padronizada. Decisão:
- "Automático" = sem intervenção
- "30fps" = reduzir `hls.maxMaxBufferLength` para processar menos frames (HLS apenas)
- "60fps" = sem intervenção (padrão já é 60fps ou menos)
- Para YouTube/Vimeo: FPS é controlado pelo player embed, botão desabilitado
- Em mobile: seletor oculto (CA-2.5)

### A5. Modo economy
- `economyMode` do hook `useVideoQuality` controla tudo
- `SyncRing`: desabilitar `animate-sync-pulse` quando economy ativo
- Chat: sem mudanças significativas (já é leve — 153 linhas, zero animações)
- Liveblocks: throttle de 80ms → 500ms (via prop no `RoomLiveblocksProvider`)
- Badge "Economy" no header da sala

---

## Tarefas

### T1 — Hook `useVideoQuality` (resolução + FPS + economy + detecção)
**Arquivo:** `hooks/useVideoQuality.ts` (novo)
**CA:** 1.8, 2.4, 3.3, 4.1–4.5
**Dependências:** nenhuma

- Criar hook com state `resolution`, `fpsLimit`, `economyMode`
- Persistir em localStorage (`rockncine-video-quality`)
- Implementar heurística `detectLowEndDevice()`: `hardwareConcurrency <= 2 || deviceMemory < 4`
- Detectar Safari via user agent (para CA-1.10)
- Retornar: `{ resolution, fpsLimit, economyMode, setResolution, setFpsLimit, setEconomyMode, isLowEnd, isSafari }`

---

### T2 — Estender `PlaybackController` com resolução
**Arquivo:** `hooks/playerController.ts`
**CA:** 1.4, 1.5
**Dependências:** nenhuma (interface only)

- Adicionar ao tipo `PlaybackController`:
  - `resolution: "720p" | "480p" | null` (null = fonte não suporta)
  - `setResolution?: (r: "720p" | "480p") => void`
  - `fpsLimit: "auto" | "30" | "60"`
  - `setFpsLimit?: (f: "auto" | "30" | "60") => void`
- O `null` indica que a fonte não suporta mudança (YouTube, .mp4, Safari HLS nativo)

---

### T3 — Integrar resolução em `useNativeVideoSync`
**Arquivo:** `hooks/useNativeVideoSync.ts`
**CA:** 1.4, 1.9, 1.10, 2.3
**Dependências:** T2

- Adicionar prop `targetResolution: "720p" | "480p"` e `fpsLimit`
- No `MANIFEST_PARSED`: calcular cap baseado em `targetResolution` (≤480 ou ≤720)
- Efeito separado que reage a mudanças em `targetResolution`:
  - Se manifesto já carregado, recalcular cap e aplicar via `hls.currentLevel`
  - Fallback: se `autoLevelCapping` dinâmico não funcionar, usar `currentLevel`
- Para FPS "30": setar `hls.maxMaxBufferLength` para valor baixo (ex: 2s)
- Retornar `resolution: "720p" | "480p"` e `setResolution` no controller
- Em Safari (sem hls.js): `resolution = null`, `setResolution = undefined`

---

### T4 — Integrar resolução em `useVimeoSync`
**Arquivo:** `hooks/useVimeoSync.ts`
**CA:** 1.5, 1.9
**Dependências:** T2

- Adicionar prop `targetResolution: "720p" | "480p"`
- Efeito que reage a mudanças em `targetResolution`:
  - Chamar `player.setQuality(targetResolution === "480p" ? "480p" : "720p")`
  - `.catch(() => {})` — silencioso para planos gratuitos
- Retornar `resolution` e `setResolution` no controller

---

### T5 — Integrar resolução em `useYouTubeSync`
**Arquivo:** `hooks/useYouTubeSync.ts`
**CA:** 1.6
**Dependências:** T2

- Retornar `resolution: null` e `setResolution: undefined` no controller
- Sem lógica adicional (YouTube API não suporta controle de qualidade)

---

### T6 — Integrar resolução em controller genérico (playback)
**Arquivo:** `hooks/playerController.ts` (ou arquivo auxiliar)
**CA:** 1.7
**Dependências:** T2

- Para fontes `.mp4/.webm` (DIRECT_MEDIA sem hls.js): retornar `resolution: null`
- Para GENERIC_IFRAME: retornar `resolution: null`

---

### T7 — Atualizar `PlayerControls` com botão de resolução
**Arquivo:** `components/room/player/PlayerControls.tsx`
**CA:** 1.1, 1.2, 1.3, 1.6, 1.7
**Dependências:** T3, T4, T5, T6

- Adicionar prop `resolution: "720p" | "480p" | null` e `onToggleResolution`
- Inserir `<button>` entre volume slider e fullscreen:
  - Se `resolution !== null`: botão clicável com texto "720p" ou "480p"
  - Se `resolution === null`: botão com `opacity-50 cursor-not-allowed` + tooltip
  - Tooltip varia: YouTube → "O YouTube controla a qualidade automaticamente"
    - .mp4/.webm → "Esta fonte não suporta mudança de resolução"
    - Safari → "Safari controla a qualidade automaticamente"
- Estilo: `flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xs font-mono`

---

### T8 — Atualizar `PlayerShell` para repassar resolução
**Arquivo:** `components/room/player/PlayerShell.tsx`
**CA:** 1.1
**Dependências:** T7

- Adicionar props `resolution` e `onToggleResolution`
- Repassar ao `<PlayerControls>`

---

### T9 — Modo economy: `SyncRing`
**Arquivo:** `components/room/SyncRing.tsx`
**CA:** 3.2 (SyncRing)
**Dependências:** T1

- Adicionar prop `economyMode: boolean`
- Quando `economyMode = true`: remover classe `animate-sync-pulse`
- Manter flash de evento (informativo, não é animação contínua)

---

### T10 — Modo economy: Liveblocks throttle
**Arquivo:** `components/RoomLiveblocksProvider.tsx`
**CA:** 3.2 (presença)
**Dependências:** T1

- Adicionar prop `economyMode: boolean`
- `throttle={economyMode ? 500 : 80}`

---

### T11 — Modo economy: badge + integração no RoomExperience
**Arquivo:** `components/room/RoomExperience.tsx`
**CA:** 3.1, 3.3, 3.4, 3.5
**Dependências:** T1, T9, T10

- Chamar `useVideoQuality()` no `RoomExperience`
- Quando `economyMode = true && resolution === "720p"`: forçar 480p (CA-3.4)
- Renderizar badge "Economy" no header quando ativo
- Integrar toggle de economy (botão ou menu)
- Repassar `economyMode` ao `SyncRing` e `RoomLiveblocksProvider`
- Repassar `resolution` e `setResolution` ao `PlayerShell`

---

### T12 — Detecção automática: componente toast
**Arquivo:** `components/room/EconomySuggestion.tsx` (novo)
**CA:** 4.2, 4.3, 4.4
**Dependências:** T1

- Componente que aparece quando `isLowEnd && !já_decidiu`
- Toast/banner não intrusivo: "Detectamos que seu dispositivo pode ter dificuldades com vídeo. Ativar modo economy?"
- Botões "Sim" e "Agora não"
- "Sim": chama `setEconomyMode(true)` + `setResolution("480p")`
- "Agora não": salva em localStorage que o usuário recusou (não sugerir novamente)
- Renderizado dentro de `RoomExperience`

---

### T13 — Testes unitários
**Arquivo:** `hooks/useVideoQuality.test.ts` (novo)
**CA:** todos
**Dependências:** T1

- Testar persistência em localStorage
- Testar heurística de detecção (mock `navigator.hardwareConcurrency`)
- Testar ciclo de resolução (720p → 480p → 720p)
- Testar modo economy force 480p
- Testar detecção Safari

---

## Ordem de execução

```
T1 (hook) → T2 (interface) → T3/T4/T5/T6 (hooks de sync) → T7/T8 (UI player)
                                                          → T9/T10/T11 (economy) → T12 (toast) → T13 (testes)
```

T1 e T2 podem rodar em paralelo (sem dependência cruzada).
T3-T6 dependem de T2.
T7 depende de T3-T6.
T9, T10 dependem de T1.
T11 depende de T1, T9, T10.
T12 depende de T1.
T13 depende de T1.
