# Spec: Tela cheia, lag e teto de qualidade

**Status:** implementado (com ressalvas)
**Pesquisa:** `research.md`

> Ressalvas: os itens 3, 4 e 6 do diagnóstico de lag (9.3) seguem **PLAUSÍVEL, não confirmado** e dependem de medição antes de qualquer mudança (§8); as decisões de 9.3 item 5 e 9.7 foram **revogadas** pela spec 04 (§8).

## 1. Problema / motivação

Dois relatos do usuário motivaram a rodada: (a) em tela cheia o vídeo não fica centrado e nada respeita margem — chat colado na borda direita, vídeo colado nas outras três; (b) "o vídeo às vezes laga", com pedido explícito de limitar toda reprodução a 720p. Como o padding da sala vive num ancestral do elemento que entra em fullscreen, o respiro some ao entrar em tela cheia; e o "lag" relatado mistura causas geradas pela própria aplicação (re-render da sala, correção de drift, cooldown de seek, `backdrop-filter`) com causas de banda/decodificação. A rodada fechou o layout de fullscreen, reposicionou o botão de teatro, diagnosticou e corrigiu parte das causas de lag, e implementou o teto de 720p onde a fonte permite. Os addenda 9.6 e 9.7 cobriram a moldura em tela cheia, um bug real do chat e a inacessibilidade de fullscreen em `GENERIC_IFRAME`.

## 2. Objetivos e não-objetivos

**Objetivos**
- Fazer o layout de tela cheia respeitar margem e centralizar o vídeo nos dois eixos.
- Reposicionar o botão de "modo teatro" junto de "carregar vídeo", sem duplicar o cluster visível.
- Reduzir/remediar as causas de lag apontáveis no código, com veredito por item.
- Implementar o teto de 720p onde a fonte permite.
- Corrigir a moldura de sync em tela cheia, o chat que zerava ao alternar fullscreen/teatro e o acesso a fullscreen/teatro em `GENERIC_IFRAME`.

**Não-objetivos**
- Não implementar teto de qualidade no YouTube (a API pública foi removida em 24/10/2019) nem em `.mp4`/`.webm` progressivo (rendition única).
- Não transcodificar nem servir variante adaptativa no servidor (fora do escopo — spec 01, seção 7).
- Não refazer a animação de `border-width` do anel de sync (já corrigida na 9.3, item 1).
- Não alterar drift/cooldown (9.3, itens 3 e 4) sem medição prévia.
- Não corrigir cosmeticamente o falloff do `box-shadow` nos cantos (9.6) — havia só a dúvida sobre normalidade, sem pedido de mudança visual.
- Não usar `currentLevel`/`nextLevel`/`loadLevel` do HLS (desligariam o ABR) nem `capLevelToPlayerSize` como mecanismo de 720p.

## 3. Histórias de usuário

- **US-1** — Como participante, quero que em tela cheia o vídeo fique centrado com margem, sem colar nas bordas da tela.
- **US-2** — Como participante em tela cheia, quero o botão de teatro ao lado do "carregar vídeo", para achar o controle.
- **US-3** — Como participante, quero que o vídeo não engasgue durante a reprodução.
- **US-4** — Como participante, quero que, onde a fonte permitir, a reprodução fique limitada a 720p.
- **US-5** — Como participante, quero saber quando a qualidade não pode ser limitada (YouTube) ou quando é best-effort (Vimeo).
- **US-6** — Como participante, quero que o chat não perca o histórico ao alternar fullscreen/teatro.
- **US-7** — Como participante que colou um embed genérico, quero conseguir entrar em tela cheia e no modo teatro.

## 4. Requisitos funcionais (EARS)

### 9.1 Layout de tela cheia (centrado, com respiro)

- **FR-001** QUANDO `isFullscreen`, o próprio elemento fullscreen (o `stageRef`) DEVE receber `h-dvh w-dvw overflow-hidden p-[clamp(0.75rem,2.5vmin,2.5rem)]`; fora de tela cheia o layout atual permanece inalterado.
- **FR-002** QUANDO `isFullscreen`, a coluna do vídeo DEVE ganhar `flex-1 min-h-0 justify-center`, centralizando verticalmente `SyncRing` + vídeo na altura útil.
- **FR-003** QUANDO `isFullscreen`, a caixa do vídeo DEVE ser limitada pelos dois eixos com `max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))] mx-auto`, com `--fs-pad` igual ao `clamp()` do padding do stage declarado uma única vez.
- **FR-004** QUANDO `isFullscreen && isTheater`, o `aside` DEVE ganhar `rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-4`; fora de tela cheia DEVE permanecer sem moldura.
- **FR-005** Em tela cheia NÃO DEVE existir barra de rolagem: `overflow-hidden` no stage e `min-h-0` na coluna do vídeo e no `aside`.

### 9.2 Botão de "modo teatro"

- **FR-006** O sistema DEVE renderizar `components/room/RoomActions.tsx` como par de botões (`[＋ carregar vídeo]` e, à direita, `[teatro]`) sempre na mesma ordem e com o mesmo estilo (`flex items-center gap-2`), com props `onLoadVideo`, `onToggleTheater`, `isTheater`, `showTheaterToggle`; NUNCA DEVE haver duas instâncias **visíveis** ao mesmo tempo.
- **FR-007** Fora de tela cheia, `RoomActions` DEVE ficar no cabeçalho da seção de presença (lado direito do `justify-between`) e o botão de teatro NÃO DEVE ser renderizado (`showTheaterToggle=false`).
- **FR-008** QUANDO `isFullscreen && isTheater`, `RoomActions` DEVE ficar no mesmo cabeçalho de presença, com o botão de teatro visível.
- **FR-009** QUANDO `isFullscreen && !isTheater` (aside oculto), `RoomActions` DEVE ser ancorado no canto superior direito da **coluna do vídeo** (coluna com `relative`, cluster em `absolute right-3 top-3 z-20`), com fundo-pílula `rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90` e SEM `backdrop-blur`.
- **FR-010** O cluster de `RoomActions` em tela cheia sem teatro NÃO DEVE sumir por inatividade: DEVE ficar em `opacity-60`, subindo para `opacity-100` em `hover`/`focus-within`.
- **FR-011** O botão de teatro DEVE ter `aria-pressed={isTheater}` e `aria-label` alternando entre "expandir vídeo" e "abrir chat ao lado", com o anel de foco duplo de spec 01, seção 8.
- **FR-012** QUANDO o usuário sai da tela cheia, `isTheater` DEVE ser zerado, fazendo o cluster voltar ao cabeçalho de presença sem o botão de teatro.

### 9.3 Diagnóstico de lag (correções confirmadas)

- **FR-013** O sistema NÃO DEVE animar `border-width` no anel de sync; o estado "ao vivo" DEVE ser sinalizado por `box-shadow` estático, sem keyframe de layout.
- **FR-014** O sistema DEVE tirar `currentTime`/`duration` do caminho de render compartilhado da sala, memoizar `Chat`/`PresenceList` e arredondar `currentTime` em 0,1 s, para cortar re-renders redundantes durante o playback.
- **FR-015** QUANDO os controles estiverem escondidos por inatividade, o sistema DEVE usar `pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100` (com `onFocusCapture={wake}` no wrapper) e NÃO DEVE usar `visibility:hidden`, mantendo fundo opaco nos overlays sobre o vídeo.

### 9.4 Teto de 720p por fonte

- **FR-016** O sistema NÃO DEVE chamar `setPlaybackQuality*` do YouTube nem passar `suggestedQuality`/`vq`, porque a API pública de qualidade foi removida; se precisar comunicar isso, DEVE ser na UI.
- **FR-017** QUANDO construir o player Vimeo, o sistema DEVE passar `max_quality: "720p"` e, após `player.ready()`, reforçar best-effort com `getQualities()` → maior id com altura ≤ 720 → `setQuality(id)` em `.catch(() => {})` silencioso; DEVE reaplicar o reforço após `loadVideo(videoId)`.
- **FR-018** QUANDO o vídeo for HLS (`.m3u8` via hls.js), o sistema DEVE registrar um handler de `Hls.Events.MANIFEST_PARSED` **antes** de `hls.loadSource(url)` que define `hls.autoLevelCapping` como o índice do maior nível com altura ≤ 720.
- **FR-019** SE nenhum nível HLS tiver altura ≤ 720, ENTÃO `autoLevelCapping` DEVE permanecer `-1` (auto, sem teto).
- **FR-020** O sistema NÃO DEVE tentar limitar qualidade de `.mp4`/`.webm` progressivo no client.

### 9.6 Addendum: moldura em tela cheia e chat que zerava

- **FR-021** `SyncRing` DEVE receber a prop `isFullscreen`; QUANDO `true`, o sistema NÃO DEVE aplicar a borda, o pulso (`animate-sync-pulse`) nem o flash (`animate-sync-flash`), mantendo apenas o `<div>` estrutural (`relative rounded-lg`); o badge "sync limitado" de `GENERIC_IFRAME` DEVE continuar aparecendo.
- **FR-022** O `<aside>` DEVE ser sempre montado; a visibilidade DEVE ser só troca de classe (`showAside ? "flex" : "hidden"` via `display:none`), nunca renderização condicional, para que `Chat`/`useChat` não sejam desmontados ao alternar fullscreen/teatro.
- **FR-023** O brilho tênue nos cantos do `SyncRing` fora de tela cheia NÃO DEVE ser tratado como regressão — é falloff esperado do `box-shadow` com `border-radius`; qualquer correção cosmética fica fora desta spec.

### 9.7 Tela cheia (e teatro) em `GENERIC_IFRAME`

- **FR-024** `PlayerShell` DEVE receber a prop `showFullscreenOnly?: boolean` (passada como `hasGeneric`); QUANDO `controller === null && showFullscreenOnly === true`, a barra DEVE renderizar **só** o botão de tela cheia, sem play/pause/scrubber/volume.
- **FR-025** SE nenhum vídeo estiver carregado, ENTÃO `showFullscreenOnly` NÃO DEVE ser `true` e nenhum botão de tela cheia DEVE ser renderizado.
- **FR-026** QUANDO `controller === null && showFullscreenOnly` (`GENERIC_IFRAME`), a barra NÃO DEVE sumir por inatividade: DEVE ficar sempre visível (`alwaysVisible`) em `opacity-60`, subindo para `opacity-100` em `hover`/`focus-within`.

## 5. Critérios de aceite (Given-When-Then)

- **AC-001** Dado o app em tela cheia, quando a sala renderiza, então o vídeo não encosta em nenhuma borda do viewport (margem ≥ 12px em todos os lados).
- **AC-002** Dado o app em tela cheia num monitor ultrawide (mais largo que 16:9), quando a caixa do vídeo renderiza, então ela mantém 16:9, tem largura ≤ `(100dvh − 2·pad)·16/9` e sobra faixa de `--bg-void` nas laterais.
- **AC-003** Dado tela cheia + teatro ligado com muitas mensagens de chat, quando a sala renderiza, então não há barra de rolagem dentro do elemento fullscreen.
- **AC-004** Dado o app fora de tela cheia, quando o cabeçalho de presença renderiza, então `RoomActions` aparece nele e o botão de teatro não é renderizado.
- **AC-005** Dado `isFullscreen && isTheater`, quando o cabeçalho de presença renderiza, então `RoomActions` aparece nele com o botão de teatro visível à direita do "carregar vídeo".
- **AC-006** Dado `isFullscreen && !isTheater`, quando a sala renderiza, então `RoomActions` fica em `absolute right-3 top-3 z-20` sobre a coluna do vídeo, dentro de uma pílula `border-[var(--line)] bg-[var(--bg-void)]/90` e sem `backdrop-blur`.
- **AC-007** Dado tela cheia sem teatro sem interação por mais de 2,5s, quando observado, então o cluster de `RoomActions` continua com `opacity` ≥ 60 e alcançável por ponteiro/teclado.
- **AC-008** Dado `isTheater = true`, quando o botão de teatro é focado, então seu `aria-pressed` é `"true"` e seu `aria-label` é "expandir vídeo".
- **AC-009** Dado tela cheia + teatro ligado, quando o usuário sai da tela cheia, então `isTheater` volta a `false` e o botão de teatro deixa de ser renderizado no cabeçalho.
- **AC-010** Dado o anel de sync em estado "ao vivo", quando a animação é inspecionada, então não há animação de `border-width` (o sinal é `box-shadow` estático).
- **AC-011** Dado os controles do player escondidos por inatividade, quando o usuário navega por Tab até eles, então eles voltam a `opacity-100` (`focus-within`) e são focáveis — não usam `visibility:hidden`.
- **AC-012** Dado um embed de YouTube, quando a reprodução inicia, então nenhuma chamada de `setPlaybackQuality*`/`suggestedQuality`/`vq` é feita.
- **AC-013** Dado um vídeo Vimeo cuja conta permite qualidade, quando o player constrói e fica pronto, então o sistema passou `max_quality: "720p"` e tentou `setQuality` do maior id ≤ 720 sem expor erro se o plano não permitir.
- **AC-014** Dado um manifesto HLS com níveis `[1080p, 720p, 480p]`, quando `MANIFEST_PARSED` dispara, então `hls.autoLevelCapping` é o índice do nível 720p.
- **AC-015** Dado um manifesto HLS só com `[1080p]`, quando `MANIFEST_PARSED` dispara, então `hls.autoLevelCapping` permanece `-1` (auto).
- **AC-016** Dado `isFullscreen = true`, quando o `SyncRing` renderiza, então recebe só `relative rounded-lg` (sem borda/pulso/flash) e mantém o badge "sync limitado" quando a fonte é `GENERIC_IFRAME`.
- **AC-017** Dado tela cheia + teatro com mensagens no chat e texto não-enviado no campo, quando o usuário alterna fullscreen/teatro, então o histórico e o rascunho permanecem.
- **AC-018** Dado `source = "GENERIC_IFRAME"` (controller `null`), quando a barra renderiza, então aparece só o botão de tela cheia (sem play/pause/scrubber/volume).
- **AC-019** Dado a sala sem vídeo carregado, quando ela abre, então nenhum botão de tela cheia é renderizado.
- **AC-020** Dado `GENERIC_IFRAME` em tela cheia sem interação, quando observado, então o botão de tela cheia continua renderizado em `opacity-60` (→ `opacity-100` em `hover`/`focus-within`).

## 6. Requisitos não-funcionais (quantificados)

- **NFR-001** Padding de tela cheia: `clamp(0.75rem, 2.5vmin, 2.5rem)` (de 12px a 40px).
- **NFR-002** Caixa do vídeo em tela cheia: 16:9, largura ≤ `(100dvh − 2·--fs-pad) × 16/9`.
- **NFR-003** Correção de drift: intervalo de 3000 ms e limiar de 1,5 s (valores da spec; revisados depois — ver §8).
- **NFR-004** `TIME_POLL_MS` do YouTube = 400 ms (≈2,5 renders/s); `timeupdate` de Vimeo e mídia nativa ≈ 4/s.
- **NFR-005** Barra mínima de `GENERIC_IFRAME`: sempre visível (`alwaysVisible`) em `opacity-60` → `opacity-100`.
- **NFR-006** Breakpoint de teatro: `lg` = 1024 px.
- **NFR-007** Teto de resolução alvo: altura ≤ 720 px.

## 7. Dados e contratos

**Tela cheia (classes).** Stage: `h-dvh w-dvw overflow-hidden p-[clamp(0.75rem,2.5vmin,2.5rem)]`. `--fs-pad` = `clamp(0.75rem,2.5vmin,2.5rem)` declarado no stage. Caixa do vídeo: `aspect-video w-full max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))] mx-auto`.

**`RoomActions`.** Props: `onLoadVideo: () => void`, `onToggleTheater: () => void`, `isTheater: boolean`, `showTheaterToggle: boolean`.

**Teto de 720p.**

```ts
// Vimeo
new Player(container, { id: videoId, controls: false, max_quality: "720p" });
// após ready(): getQualities() -> maior id com altura <= 720 -> setQuality(id).catch(() => {})

// HLS (antes de loadSource)
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  hls.autoLevelCapping = hls.levels.reduce(
    (best, lvl, i) => (lvl.height <= 720 && (best < 0 || lvl.height > hls.levels[best].height) ? i : best),
    -1,
  );
});
```

**`PlayerShell`.** Prop `showFullscreenOnly?: boolean` (passada como `hasGeneric`); `alwaysVisible = !controller && showFullscreenOnly`; a barra mínima renderiza só o botão de tela cheia quando `controller === null && showFullscreenOnly === true`.

**`SyncRing`.** Prop `isFullscreen: boolean`; com `true`, não aplica borda/pulso/flash (só `relative rounded-lg`).

## 8. Riscos / dependências

**Dependências.** `hls.js@1.7.1` (`autoLevelCapping`, `MANIFEST_PARSED`); `@vimeo/player@2.30.4` (`max_quality`, `setQuality`, `getQualities` — disponíveis só em contas Plus/PRO/Business do **dono do vídeo**); YouTube IFrame Player API (sem API pública de qualidade).

**Riscos.**
- O teto Vimeo é *best-effort*: o gate é o plano de quem subiu o vídeo; `max_quality` não é documentado na Central de Ajuda (só no SDK instalado) e deve falhar em silêncio — nunca cair em `setError`.
- `quality: "720p"` fixaria a qualidade e desligaria o ABR (pode piorar rede ruim) — usar `max_quality`.
- HLS: `currentLevel`/`nextLevel`/`loadLevel` alteram o ABR/rebufferizam; só `autoLevelCapping` é aceitável.
- Em `GENERIC_IFRAME` não há camada de captura de ponteiro possível (bloquearia o clique dentro do iframe).

### Decisões revogadas (marcador `REVISADO`)

| Ponto | Decisão original (esta spec) | Quem revogou | Decisão vigente | Motivo |
|---|---|---|---|---|
| 9.3, item 5 | Controles escondidos também com `invisible` (`visibility:hidden`), além de `opacity-0` | `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`, achado 3 | `pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100` + `onFocusCapture={wake}`; **sem** `visibility:hidden`; fundo opaco mantido | `visibility:hidden` tira os controles da ordem de tabulação e, como o `wake` só escutava ponteiro/toque, o player ficava inacessível por teclado após 2,5s. A justificativa de compositor era o `backdrop-filter`, que já não existe nessa barra desde a 9.2. |
| 9.7 | Barra mínima de `GENERIC_IFRAME` some por inatividade (auto-hide) | `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`, achado 1 | `alwaysVisible = !controller && showFullscreenOnly`: botão sempre renderizado em `opacity-60` → `opacity-100` em `hover`/`focus-within` | Em `GENERIC_IFRAME` a área toda é um iframe cross-origin; a camada de captura de ponteiro (spec 01, seção 7) não pode ser montada (bloquearia o clique dentro do iframe, único controle possível), então escondida a barra ficava inalcançável — e com ela o único caminho de volta ao modo teatro. |

### Pendências de medição (9.3, itens 3, 4 e 6 — PLAUSÍVEL, não confirmado)

- **Item 3** (drift com `seekTo`/`allowSeekAhead`): direção proposta — limiar de reengate maior que o de disparo, teto de N correções/minuto e pular a correção sob `BUFFERING`; confirmar com log real antes de mexer.
- **Item 4** (cooldown fixo de 400 ms): direção proposta — encerrar o cooldown por evento (`PLAYING`/`seeked` observado) em vez de relógio, generalizando a abordagem do Vimeo (que resolve por Promise, sem timeout fixo).
- **Item 6** (`overflow-hidden rounded-md` na caixa do vídeo): verificar com "Layer borders" + "Frame rendering stats" do DevTools antes de qualquer mudança.
- **Nota histórica:** `docs/specs/README.md` registra que a spec 08 revisitou os valores concretos (o cooldown do YouTube passou a 1500 ms fixo), permanecendo a ressalva de "timeout fixo em vez de resolução por evento".

## Anexo A — numeração legada (âncoras citadas pelo código)

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| seção 9.1 | Layout de tela cheia: centrado, com respiro em todos os lados | FR-001 a FR-005 | components/room/SyncRing.tsx:27, components/room/RoomExperience.tsx:32, components/room/RoomActions.tsx:66 |
| seção 9.2 | Onde mora o botão de "modo teatro" | FR-006 a FR-012 | components/room/RoomActions.tsx:17, components/room/player/PlayerShell.tsx:34 |
| seção 9.3 | Diagnóstico do "vídeo lagando" | FR-013 a FR-015 | components/room/player/PlayerShell.tsx:115 |
| seção 9.4 | Teto de 720p: o que é possível por fonte | FR-016 a FR-020 | hooks/useNativeVideoSync.ts:131, hooks/useVimeoSync.ts:36, hooks/useVimeoSync.ts:191 |
| seção 9.6 | Addendum pós-implementação: moldura em tela cheia e chat que zerava | FR-021 a FR-023 | components/room/RoomExperience.tsx:530, components/room/RoomActions.tsx:19, components/room/SyncRing.tsx:29 |
| seção 9.7 | Tela cheia (e modo teatro) inacessíveis em GENERIC_IFRAME | FR-024 a FR-026 | (sem citação no código; citada em docs/specs/01-fundacao-mvp/spec.md) |
