# Tela cheia centrada, diagnóstico de lag e teto de qualidade

**Status:** implementado

Rodada motivada por dois relatos do usuário: (a) em tela cheia o vídeo não fica centrado e nada
respeita margem — chat colado na borda direita da tela, vídeo colado nas outras três; (b) "o vídeo
às vezes laga", com pedido explícito de limitar toda reprodução a 720p. Esta seção é a spec de
implementação das duas coisas; nenhum código foi escrito nesta rodada.

### 9.1 Layout de tela cheia: centrado, com respiro em todos os lados

**Por que hoje fica colado na borda.** O padding que dá respiro ao conteúdo da sala vive no `<main>`
(`px-6 py-8`, `RoomExperience.tsx:110`), mas o alvo de `requestFullscreen()` é o `stageRef`
(`RoomExperience.tsx:132-135`), que é *filho* do `main`. Ao entrar em tela cheia, o elemento
fullscreen passa a ter o tamanho exato do viewport e o padding do ancestral deixa de valer — o stage
vira uma caixa 100vw × 100vh sem padding próprio. A caixa do vídeo é `aspect-video w-full`
(`RoomExperience.tsx:154`): com largura livre de 100vw ela cresce até encostar nas laterais e, em
telas mais largas que 16:9, ainda estoura a altura disponível. O `aside` (`:214`) não tem margem
própria, então encosta na borda direita.

**Regra geral desta spec:** em tela cheia, quem dá o respiro é o **próprio elemento fullscreen**
(o `stageRef`), nunca um ancestral. E a caixa do vídeo é limitada pelos **dois** eixos, não só pela
largura.

Alterações, todas condicionadas a `isFullscreen` (fora de tela cheia o layout atual permanece
exatamente como está):

1. **Padding no stage** (`RoomExperience.tsx:132-135`). Adicionar, quando `isFullscreen`:
   `h-dvh w-dvw overflow-hidden p-[clamp(0.75rem,2.5vmin,2.5rem)]`. `vmin` faz a margem escalar com
   a menor dimensão da tela (respiro proporcional em 1080p e em ultrawide), com piso pra telas
   pequenas e teto pra não desperdiçar área em 4K. O stage já tem `bg-[var(--bg-void)]`, então a
   margem fica preta-void e não o preto default do `::backdrop` — manter.
2. **Coluna do vídeo centrada** (`RoomExperience.tsx:148`). Adicionar `min-h-0 justify-center` à
   coluna (ela já é `flex flex-col`); em tela cheia a coluna também precisa de `flex-1`. Isso
   centraliza verticalmente o bloco `SyncRing` + vídeo dentro da altura útil.
3. **Caixa do vídeo limitada pela altura, não só pela largura**
   (`RoomExperience.tsx:154`, o `div` com `aspect-video w-full`). Em tela cheia acrescentar:
   `max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))] mx-auto`, com `--fs-pad` declarado no
   stage com o mesmo `clamp()` do item 1 (declarar o token no `style` inline do stage ou como
   utility em `globals.css`; um valor literal duplicado nos dois lugares também funciona, mas
   dessincroniza). É o truque clássico de encaixar 16:9 numa caixa: a largura tenta 100%, mas nunca
   passa da largura que a altura disponível comporta — sem brigar com `aspect-ratio`, sem
   `object-fit`, sem distorcer a caixa. Resultado: em qualquer proporção de tela o vídeo fica
   centrado com barras de `--bg-void` sobrando no eixo folgado, e o padding do item 1 garante que
   ele nunca encoste em borda alguma.
4. **`aside` com margem e forma própria em tela cheia** (`RoomExperience.tsx:214`). O padding do
   stage já descola o painel da borda direita; além disso, em `isFullscreen && isTheater` o `aside`
   ganha `rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-4` pra ler como painel
   flutuante dentro da tela cheia, e não como uma coluna cortada pela borda. Fora de tela cheia
   continua sem moldura (o chat já tem a sua).
5. **Sem scroll na tela cheia.** `overflow-hidden` no stage (item 1) + `min-h-0` na coluna do vídeo
   e no `aside` (esse já tem) evitam que o chat empurre a altura e crie barra de rolagem dentro do
   elemento fullscreen.

Piso de qualidade herdado de `docs/specs/01-fundacao-mvp/spec.md`, seção 8: nada disso pode depender de matiz, e a margem não é
decoração — é o que impede o vídeo de brigar com a borda física do monitor.

### 9.2 Onde mora o botão de "modo teatro"

Hoje ele flutua solto em `absolute right-2 top-2` dentro do stage (`RoomExperience.tsx:136-146`),
descolado de qualquer outro controle. Pedido do usuário: ficar **imediatamente à direita do botão
"carregar vídeo"** (`RoomExperience.tsx:220-227`), que vive no cabeçalho da seção de presença. O
problema é que esse cabeçalho só existe quando o `aside` é renderizado, e em tela cheia sem teatro o
`aside` não existe (`showAside = !isFullscreen || isTheater`, `:107`).

**Decisão: o par vira uma unidade, e só a âncora muda.** Extrair um componente
`components/room/RoomActions.tsx` que renderiza sempre os mesmos dois botões, na mesma ordem e com o
mesmo estilo (`flex items-center gap-2`): `[＋ carregar vídeo]` e, à direita dele, `[teatro]`.
Props: `onLoadVideo`, `onToggleTheater`, `isTheater`, `showTheaterToggle`. Nunca é renderizado duas
vezes ao mesmo tempo.

| Estado | `showAside` | Onde `RoomActions` é renderizado | Botão de teatro |
|---|---|---|---|
| Fora de tela cheia | `true` | cabeçalho da seção de presença, lado direito do `justify-between` (onde o "carregar vídeo" já está hoje) | **não renderizado** (`showTheaterToggle=false`) — teatro só significa algo dentro de fullscreen |
| Tela cheia + teatro **ligado** | `true` | mesmo lugar: cabeçalho de presença, dentro do `aside` | renderizado, colado à direita do "carregar vídeo" — exatamente o pedido |
| Tela cheia + teatro **desligado** | `false` | overlay ancorado no **canto superior direito da coluna do vídeo** (não do stage): a coluna (`RoomExperience.tsx:148`) ganha `relative`, e o cluster vai em `absolute right-3 top-3 z-20` | renderizado, na mesma ordem e com o mesmo visual |

Detalhes que fecham a decisão:

- A âncora do overlay é a **coluna do vídeo**, não o stage — assim o cluster já nasce dentro do
  padding da 9.1 e nunca encosta na borda da tela.
- Fundo do overlay: pílula `rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90`. **Sem
  `backdrop-blur`** — ver 9.3, item 5.
- Visibilidade: no estado tela-cheia-sem-teatro esse cluster é o único caminho de volta pro chat,
  então não some por inatividade; fica em `opacity-60`, subindo pra `opacity-100` em
  `hover`/`focus-within`. (Diferente da barra de controles, que continua com o auto-hide do
  `PlayerShell`.)
- Acessibilidade preservada do botão atual: `aria-pressed={isTheater}` e `aria-label` alternando
  entre "expandir vídeo" / "abrir chat ao lado"; anel de foco duplo de `docs/specs/01-fundacao-mvp/spec.md`, seção 8.
- Ao sair da tela cheia, `isTheater` já é zerado (`RoomExperience.tsx:55`), então o cluster volta
  sozinho pro cabeçalho de presença sem o botão de teatro. Nenhum estado novo é necessário.

### 9.3 Diagnóstico do "vídeo lagando"

Lista fechada: só entra o que dá pra apontar no código. Cada item traz veredito explícito.

1. **`border-width` animado a cada 3s — CONFIRMADO, já corrigido.** `.animate-sync-pulse`
   (`app/globals.css:46`) animava `border-width` (2px↔3px) em loop enquanto qualquer vídeo tocava.
   `border-width` é propriedade de layout: cada frame da animação forçava reflow, no ancestral
   direto do elemento de vídeo. Hoje é `box-shadow` estático, sem keyframe (ver `docs/specs/01-fundacao-mvp/spec.md`, seção 8, "Assinatura
   visual: anel de sync"). Não refazer.
2. **Re-render da árvore inteira da sala 2,5–4×/s durante o playback — CONFIRMADO.** Os três hooks
   de sync são chamados no topo de `RoomExperience` (`:69-76`) e guardam `currentTime` em `useState`
   local:
   - YouTube: `TIME_POLL_MS = 400` (`hooks/useYouTubeSync.ts:13`) com `setCurrentTime` a cada tick
     (`:209-222`) — 2,5 renders/s.
   - Vimeo: `timeupdate` do SDK chamando `setCurrentTime` (`hooks/useVimeoSync.ts:120-123`) — ~4/s.
   - Mídia direta: `onTimeUpdate` nativo (`hooks/useNativeVideoSync.ts:201`) — ~4/s.

   Como o estado vive no componente que renderiza a sala toda, cada tick re-renderiza
   `RoomExperience` + `Chat` (que remapeia até 200 `<li>`, `components/room/Chat.tsx:35-55`) +
   `PresenceList` + `SyncRing` + `PlayerShell` + `PlayerControls`. Nada é `memo`, e o objeto
   `controller` é recriado a cada render (ex. `useYouTubeSync.ts:317`), então nenhuma barreira de
   memoização adiantaria sem refatorar isso junto. É trabalho de main thread contínuo na mesma
   thread que compõe o vídeo — magnitude a medir com o Profiler, mas a existência do custo é fato,
   não hipótese. Direção de correção: tirar `currentTime`/`duration` do caminho de render
   compartilhado (contexto com seletor, `useSyncExternalStore`, ou manter o scrubber numa folha que
   assina sozinha), `memo` em `Chat`/`PresenceList`, e arredondar `currentTime` (0,1s) pra cortar
   renders redundantes.
3. **Loop de correção de drift com `seekTo` — PLAUSÍVEL, não confirmado.**
   `hooks/useYouTubeSync.ts:225-264`: a cada `CHECK_INTERVAL_MS = 3000`, quem não é dono da última
   ação e está a mais de `DRIFT_THRESHOLD_S = 1.5` do esperado leva
   `player.seekTo(expected, true)` (`:259`). `allowSeekAhead = true` obriga o YouTube a pedir um
   novo range ao servidor e rebufferizar — visualmente é exatamente um "engasgo". Num participante
   com rede ou CPU mais lenta, o drift volta a passar de 1,5s antes dos próximos 3s, e a correção
   vira permanente: engasgo a cada 3 segundos, indefinidamente. Não há histerese, nem backoff, nem
   checagem de `BUFFERING` (o código só testa `PAUSED`, `:244`). Confirmar com log de quantas
   correções por minuto acontecem antes de mexer; correção provável: limiar de reengate maior que o
   de disparo, teto de N correções/minuto e pular a correção enquanto o estado for `BUFFERING`.
4. **Cooldown de 400ms curto demais pra duração real de um seek — PLAUSÍVEL, não confirmado.**
   `REMOTE_APPLY_COOLDOWN_MS = 400` (`useYouTubeSync.ts:12`, `useNativeVideoSync.ts:12`) é um
   `setTimeout` fixo. No YouTube, `seekTo` durante playback produz `BUFFERING` e só depois `PLAYING`;
   se esse `PLAYING` chegar após 400ms, ele escapa do guard e `onStateChange` (`:130-158`) trata a
   correção silenciosa como ação de usuário: `commitPlayer` + `broadcast(PLAY)`. Esse cliente vira
   `lastActorId` e passa a arrastar os outros — realimentando o item 3 em todo mundo. Mesma classe
   de falha na mídia direta: `seeked` disparado depois dos 400ms cai em `onSeeked`
   (`useNativeVideoSync.ts:183-199`) e emite um `SEEK` espúrio. O Vimeo é imune a essa variante
   porque lá o cooldown termina quando a promise resolve, não num timeout fixo
   (`useVimeoSync.ts:43-54`) — o que sugere que a correção certa é generalizar essa abordagem:
   encerrar o cooldown por evento (`PLAYING`/`seeked` observado) e não por relógio.
5. **`backdrop-blur` sobre a área do vídeo — PLAUSÍVEL, custo de GPU.** `PlayerControls.tsx:42` e o
   botão de teatro atual (`RoomExperience.tsx:142`) usam `backdrop-blur-sm`. `backdrop-filter` obriga
   o compositor a reprocessar a região atrás do elemento a cada frame de vídeo enquanto o elemento
   está visível — e o auto-hide da barra só muda opacidade (`PlayerShell.tsx:59-61`), sem tirar do
   DOM nem aplicar `visibility: hidden`, então a camada continua viva mesmo "escondida". Correção
   barata: `invisible` (não só `opacity-0`) quando escondida, e fundo opaco em vez de blur nos
   overlays sobre o vídeo — já refletido em 9.2.

   **REVISADO em `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md` (achado 3): o `invisible` foi desfeito, o fundo opaco continua.**
   `visibility: hidden` tira os controles da ordem de tabulação, e como o `wake` só escutava
   ponteiro/toque não sobrava nenhum caminho de teclado até a barra — o player inteiro ficava
   inacessível por teclado depois de 2,5s. Hoje o estado escondido é
   `pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100`
   (`PlayerShell.tsx:101`), mais `onFocusCapture={wake}` no wrapper (`:79`). A troca é segura porque
   a justificativa de compositor deste item era o `backdrop-filter`, que já não existe nessa barra
   desde a 9.2 — uma camada com `opacity: 0` e sem `backdrop-filter` não obriga o compositor a
   reprocessar a região atrás dela a cada frame.
6. **`overflow-hidden rounded-md` na caixa do vídeo — PLAUSÍVEL, não confirmado.**
   `RoomExperience.tsx:154`. Recorte com raio em cima de uma camada de vídeo pode tirar o vídeo do
   caminho rápido de composição/overlay de hardware do navegador. Verificável em minutos com
   "Layer borders" + "Frame rendering stats" do DevTools; teste barato: remover o arredondamento só
   em tela cheia e comparar frames descartados. Não mexer antes de medir.
7. **"Os três hooks de sync rodam ao mesmo tempo" — DESCARTADO como causa de lag.** É verdade que os
   três ficam montados sempre (`RoomExperience.tsx:69-76`), com três `setInterval` de 3s e três
   listeners de broadcast. Mas os hooks inativos saem na primeira linha do tick (`!player` /
   `!videoEl` → `return`, ex. `useYouTubeSync.ts:229`) e o poll de 400ms do YouTube é gated por
   `isReady` (`:210`). Custo desprezível. O que **não** é desprezível é o item 2, que é consequência
   de onde o estado mora, não de quantos hooks existem.
8. **Transição de auto-hide da barra — DESCARTADO.** `transition-opacity duration-200`
   (`PlayerShell.tsx:59`) anima só opacidade: propriedade de compositor, não dispara reflow nem
   repaint de layout. O problema naquele componente é o `backdrop-filter` do item 5, não a
   transição.
9. **Efeito de scroll do chat — DESCARTADO.** `Chat.tsx:17-20` lê `scrollHeight` (leitura forçada de
   layout) num efeito com deps `[messages]`; `messages` é estado estável vindo de `useChat`
   (`hooks/useChat.ts:15-22`), então o efeito só roda quando chega mensagem, não a cada render do
   item 2.

**Expectativa a alinhar com o usuário:** limitar a 720p (9.4) ataca *outra* causa — banda e custo de
decodificação. Não resolve nada dos itens 2, 3 e 4, que são lag gerado pela própria aplicação. Se o
sintoma for "engasga a cada poucos segundos", a aposta é 3+4; se for "trava e volta em rede ruim", é
o teto de qualidade.

### 9.4 Teto de 720p: o que é possível por fonte

Pesquisa verificada contra a documentação oficial e contra as versões instaladas
(`hls.js@1.7.1`, `@vimeo/player@2.30.4`), não de memória. **Resumo: dá pra fazer em 1 das 4 fontes
de forma completa, 1 de forma parcial e condicionada, e 2 não dá.**

| Fonte | Teto de 720p | Mecanismo |
|---|---|---|
| YouTube | **Não é possível** | API pública de qualidade removida |
| Vimeo | **Parcial e condicionado** | `max_quality` / `setQuality()`, dependente do plano de quem subiu o vídeo |
| HLS (`.m3u8` via hls.js) | **Sim, completo** | `hls.autoLevelCapping` |
| `.mp4`/`.webm` progressivo | **Não é possível no client** | não existem renditions alternativas |

#### YouTube — não é achievable pela API pública

Verificado na referência oficial da IFrame Player API: *"The `getPlaybackQuality`,
`setPlaybackQuality`, and `getAvailableQualityLevels` functions are no longer supported"*, e as
funções de fila (`loadVideoById`, `cueVideoById`, etc.) *"no longer support the `suggestedQuality`
argument… If `suggestedQuality` is specified, it will be ignored"* — ignorado silenciosamente, sem
warning nem erro. O histórico de revisões data a documentação dessa remoção em **24/10/2019**,
registrando que a mudança já estava em vigor havia mais de um ano; `setPlaybackQualityRange`
desapareceu junto e não consta mais da referência. O único resquício é o evento
`onPlaybackQualityChange`, que continua existindo mas é apenas um sinal de leitura — e como
`getPlaybackQuality` também foi removido, nem exibir a qualidade atual é contrato garantido.

O parâmetro de URL `vq` **não** consta da lista de parâmetros suportados (a página documenta
`autoplay`, `cc_lang_pref`, `cc_load_policy`, `color`, `controls`, `disablekb`, `enablejsapi`,
`end`, `fs`, `hl`, `iv_load_policy`, `list`, `listType`, `loop`, `modestbranding`, `origin`,
`playlist`, `playsinline`, `rel`, `start`, `widget_referrer` — e marca `modestbranding`,
`showinfo`, `autohide` e `theme` como depreciados e sem efeito). Não há parâmetro de qualidade.

**Veredito: "sempre limitar embeds do YouTube a 720p" não é alcançável.** Não implementar chamada
alguma de `setPlaybackQuality*` nem passar `suggestedQuality`/`vq` — seria código morto que dá falsa
sensação de estar funcionando. Se o app precisar comunicar isso, é na UI ("a qualidade do YouTube é
decidida pelo YouTube"), não em código. Existe folclore de que o tamanho renderizado do iframe
influencia a escolha do ABR do YouTube; **não verificado documentalmente**, colide frontalmente com
tela cheia, e não deve ser tratado como mecanismo.

Fontes: [IFrame Player API
Reference](https://developers.google.com/youtube/iframe_api_reference) ·
[Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)

#### Vimeo — parcial, e o gate é o plano de quem subiu o vídeo

O SDK instalado (`@vimeo/player@2.30.4`) expõe, em `node_modules/@vimeo/player/types/player.d.ts`:

```ts
getQualities(): Promise<VimeoQuality[]>;              // :130 — { label, id, active }[]
getQuality(): Promise<VideoQualityId>;                // :135
setQuality(quality: VideoQualityId): Promise<VimeoQuality>; // :141
```

com a nota, na própria documentação do tipo: *"available to Plus, PRO and Business accounts"* e
`@throws {TypeError} If the specified quality is not available`. As opções de embed aceitas pelo
construtor incluem (`node_modules/@vimeo/player/dist/player.es.js:818` e
`types/formats.ts`): `quality`, `initial_quality`, `max_quality`, `min_quality`,
`quality_selector`. `max_quality` é descrito nos tipos instalados como *"The highest possible
quality that the player automatically switches to during video playback"* — semântica de **teto**,
que é exatamente o que se quer (mantém o ABR vivo abaixo do limite, em vez de fixar).

Ressalvas importantes, todas verificadas:

- O gate de plano é do **dono do vídeo**, não nosso. Como a sala embeda link de terceiro arbitrário,
  o teto vai funcionar em alguns vídeos e ser ignorado em outros. Não há como saber antes de tentar.
- A Central de Ajuda da Vimeo documenta o parâmetro `quality` (*"This feature requires a paid plan
  on Vimeo"*, valores `4K`, `2K`, `1080p`, `720p`, `540p`, `360p`, `240p`) mas **não** documenta
  `max_quality`/`min_quality` — esses só aparecem no SDK instalado. Tratar `max_quality` como
  best-effort, nunca como contrato.
- `quality: '720p'` **fixa** a qualidade em vez de limitar: desliga o ABR e pode *piorar* o
  travamento em rede ruim (o player deixa de poder cair pra 360p). Preferir `max_quality`.
- Se a qualidade pedida não existir no vídeo, o parâmetro é ignorado e o player volta pra `auto`;
  `setQuality()` rejeita (`TypeError`).

**Implementação especificada** (`hooks/useVimeoSync.ts`):

1. Linha 91 — construir com o teto: `new Player(container, { id: videoId, controls: false,
   max_quality: "720p" })`.
2. Depois de `player.ready()` (`:98`), reforço best-effort: `getQualities()` → escolher o maior id
   com altura ≤ 720 → `setQuality(id)`, tudo em `.catch(() => {})`. **Obrigatoriamente silencioso**:
   rejeitar em vídeo de conta free é o caso comum, não um erro a exibir; não pode cair no `setError`
   do hook.
3. Depois de `loadVideo(videoId)` (`:79`, troca de vídeo sem recriar o player), reaplicar o passo 2
   — não está verificado se as opções de embed do construtor sobrevivem a um `loadVideo`.

Fontes: [player.js README](https://github.com/vimeo/player.js) ·
[Set a default quality for embedded
videos](https://help.vimeo.com/hc/en-us/articles/12426487034641-Set-a-default-quality-for-embedded-videos)
· [Player SDK: Embed Options](https://developer.vimeo.com/player/sdk/embed)

#### HLS (`.m3u8` via hls.js) — possível e completo

Único caso em que o teto é real e determinístico. API conferida em
`node_modules/hls.js/dist/hls.js.d.ts` da versão instalada (`hls.js@1.7.1`):

- `set autoLevelCapping(newLevel: number)` / `get autoLevelCapping(): number` (`:2125`, `:2140`) —
  *"Capping/max level value that should be used by automatic level selection algorithm
  (`ABRController`)"*. É o mecanismo certo: o ABR continua funcionando, só nunca escolhe acima do
  índice informado. `get maxAutoLevel()` (`:2158`) reflete o teto em vigor.
- `get levels(): Level[]` — cada `Level` expõe `height`, `width`, `bitrate` (`:3077-3086`).
- Padrões verificados no bundle instalado (`dist/hls.mjs`): `capLevelToPlayerSize: false`
  (`:38053`), `autoLevelCapping` inicializado em `-1` (`:40044`, sem teto), `startLevel: undefined`
  (`:38122`).

**Implementação especificada** (`hooks/useNativeVideoSync.ts:98-108`), entre `new Hls()` e
`hls.loadSource(url)`:

```ts
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  // maior nível com altura <= 720; -1 (auto, sem teto) se nenhum couber
  const cap = hls.levels.reduce(
    (best, lvl, i) =>
      lvl.height <= 720 && (best < 0 || lvl.height > hls.levels[best].height) ? i : best,
    -1,
  );
  hls.autoLevelCapping = cap;
});
```

Registrar o handler **antes** de `loadSource` — `MANIFEST_PARSED` dispara antes da escolha do
primeiro fragmento, então o teto já vale no primeiro segmento, sem precisar mexer em `startLevel`.

O que **não** usar, e por quê (justificativa nos próprios docs dos tipos instalados):

- `hls.currentLevel = i` (`:2058`) — *"will flush the current buffer… playback will interrupt at
  least shortly to re-buffer"*. Introduz exatamente o engasgo que esta rodada quer eliminar.
- `hls.nextLevel` / `hls.loadLevel` (`:2069`, `:2080`) — colocam o player em modo manual e desligam o
  ABR: em rede ruim ele perde a capacidade de cair de qualidade. `autoLevelCapping` preserva o ABR.
- `config.capLevelToPlayerSize: true` (`:776`) — limita pelo **tamanho renderizado**, não por altura
  absoluta. Em tela cheia isso *sobe* o teto efetivo, ou seja, faz o oposto do pedido. Pode
  coexistir como heurística, mas não é o mecanismo do 720p.
- Se nenhum nível tiver altura ≤ 720, manter `-1` (auto). Forçar o menor nível disponível degradaria
  o vídeo sem necessidade.

#### `.mp4`/`.webm` progressivo — não é possível no client

Um arquivo progressivo é **uma** rendition: o `<video>` baixa aquele arquivo e nada mais. Não existe
manifesto, não existe lista de variantes, e o `HTMLVideoElement` não expõe API alguma de qualidade —
não há o que "limitar". Definir `width`/`height` no elemento só muda o tamanho de exibição; a
decodificação continua na resolução nativa do arquivo, então nem o custo de CPU cai.

**Veredito: "cap a 720p" não se aplica a `DIRECT_MEDIA` não-HLS.** A única solução real é
server-side — transcodificar pra 720p ou servir uma variante adaptativa (HLS/DASH) —, o que exige
pipeline de mídia própria e está fora do escopo (`docs/specs/01-fundacao-mvp/spec.md`, seção 7, já estabelece que o app não faz proxy nem
processamento de conteúdo de terceiro). Se um `.mp4` de 1080p/4K travar, o caminho honesto é dizer
isso na UI, não fingir um controle que não existe.

### 9.5 Ordem de implementação sugerida

1. 9.1 + 9.2 (layout e botão) — puramente visual, sem risco de regressão de sync, e é o que o
   usuário vê primeiro.
2. 9.3 item 5 (`invisible` em vez de só `opacity-0`, tirar `backdrop-blur` de cima do vídeo) — barato
   e já vem junto de 9.2.
3. 9.4 HLS (`autoLevelCapping`) + Vimeo (`max_quality`) — pequenos, isolados em um hook cada.
4. 9.3 item 2 (arquitetura de re-render) — o maior e o mais arriscado; mexe em como o estado do
   player é distribuído. Fazer com medição antes/depois no Profiler, não no olho.
5. 9.3 itens 3 e 4 (drift/cooldown) — só depois de instrumentar e confirmar com log real quantas
   correções por minuto acontecem numa sessão que "laga". Mexer em sync sem medição é trocar um bug
   por outro.

### 9.6 Addendum pós-implementação: moldura em tela cheia e chat que zerava

Rodada de ajuste depois de 9.1–9.5 estarem no ar, motivada por dois prints do usuário em tela cheia
e um relato de bug funcional.

**Moldura de sync (`SyncRing`) desligada em tela cheia.** Fora de tela cheia a borda/brilho/flash de
`SyncRing.tsx` sinaliza estado da sala num contexto onde o vídeo divide tela com chat/presença. Em
tela cheia esse contexto já não existe — o vídeo *é* a tela, com o respiro próprio da 9.1 — e a
moldura passa a ser só chrome supérfluo ao redor da imagem. `SyncRing` ganhou a prop `isFullscreen`
(passada de `RoomExperience.tsx`); com ela `true`, a borda, o `animate-sync-pulse` e o flash de
`animate-sync-flash` não são aplicados — só o `<div>` estrutural (`relative rounded-lg`) permanece,
sem nenhuma cor/brilho. O badge "sync limitado" (`GENERIC_IFRAME`) continua aparecendo mesmo em tela
cheia: é informação (controle manual necessário), não decoração.

**Brilho tênue nos cantos fora de tela cheia — comportamento esperado do `box-shadow`, não bug.**
`.animate-sync-pulse` (`app/globals.css:46`) é `box-shadow: 0 0 14px 1px rgba(255,255,255,0.22)`
sem spread negativo nem segunda camada. Um `box-shadow` acompanha o `border-radius` do próprio
elemento (`rounded-lg`), então nas bordas retas o brilho se espalha uniformemente perpendicular à
aresta; no arco do canto, a mesma quantidade de luz se distribui ao longo de uma curva mais curta,
lida visualmente como mais fraca ali — é falloff gaussiano padrão do algoritmo de blur do
`box-shadow`, replicável em qualquer elemento com `border-radius` + `box-shadow`, não uma
particularidade deste componente. Não é regressão dos ajustes desta seção nem do fix do
`border-width` animado (item 1 da 9.3). Se um dia quiser corrigir cosmeticamente, o caminho é
reforçar especificamente os cantos (segunda camada de `box-shadow` com spread maior, ou
`filter: drop-shadow` num pseudo-elemento) — não feito nesta rodada por ser puramente estético, sem
pedido explícito de mudança visual, só a dúvida sobre normalidade.

**Bug real: mensagens de chat zeravam ao alternar fullscreen/teatro — CONFIRMADO e corrigido.**
`useChat.ts` guarda o histórico só em `useState` local (decisão travada: chat não persiste —
`docs/specs/01-fundacao-mvp/spec.md`, seção 2). Antes desta rodada, `RoomExperience.tsx` renderizava o `<aside>` (e portanto `<Chat>`, e portanto
`useChat`) condicionalmente: `{showAside && (<aside>...)}`. Toda vez que `showAside` virava `false`
— entrar em tela cheia sem teatro — React desmontava `<Chat>` de verdade, destruindo o estado do
hook; ao `showAside` voltar a `true` — ligar o teatro dentro da tela cheia, ou sair da tela cheia —
`<Chat>` remontava do zero, com `useChat` reinicializando `messages` em `[]`. Sintoma relatado:
histórico sumindo tanto ao abrir o chat lateral dentro da tela cheia quanto ao digitar em tela cheia
e sair dela.

Correção: `<aside>` agora é **sempre montado**; a visibilidade que antes era renderização
condicional virou só troca de classe (`showAside ? "flex" : "hidden"`, `display:none` via Tailwind
`hidden`). `Chat`/`useChat` nunca mais desmontam por causa de fullscreen ou teatro — só o layout
(`lg:basis-[80%]`/`w-full` na coluna do vídeo, que já era baseado na mesma variável `showAside`)
continua reagindo normalmente. Efeito colateral positivo: o rascunho não-enviado no campo de
mensagem também deixa de ser perdido nesses toggles, pelo mesmo motivo.

### 9.7 Tela cheia (e modo teatro) inacessíveis em `GENERIC_IFRAME`

A 9.2 assumia que o botão de tela cheia sempre existe — mas ele mora dentro de `PlayerControls`
(`components/room/player/PlayerControls.tsx:105-116`), renderizado por `PlayerShell` só quando há um
`PlaybackController` (`{controller && (...)}`). `GENERIC_IFRAME` (iframe arbitrário de terceiro, ex.
um agregador de streaming) nunca tem controller — não existe API pra tocar/pausar/buscar um iframe
opaco de outro domínio — então `activeController` é `null` e a barra inteira, botão de tela cheia
incluso, simplesmente não renderizava. Resultado: pra essa fonte não havia nenhum caminho até tela
cheia e, por consequência, nenhum até o modo teatro/botão de teatro da 9.2 — o "abrir chat" que o
usuário via em sites de referência (print, watch-party de terceiro) não tinha equivalente aqui.

Correção: `PlayerShell` ganhou a prop `showFullscreenOnly?: boolean` (passada como `hasGeneric` por
`RoomExperience.tsx`). Com `controller === null` e `showFullscreenOnly === true`, a barra inferior
(mesmo container com auto-hide de `PlayerShell.tsx`) renderiza só o botão de tela cheia — sem
play/pause/scrubber/volume, que não fazem sentido pra um iframe que a sala não controla. Uma vez em
tela cheia, o resto já funciona sem mudança nenhuma: o botão de teatro (`RoomActions`, 9.2) é
agnóstico de fonte de vídeo — não depende de `PlaybackController`, só do estado `isFullscreen`/
`isTheater` de `RoomExperience`. Vídeo sem fonte nenhuma carregada (placeholder "use carregar
vídeo...") continua sem botão de tela cheia — `showFullscreenOnly` só é `true` quando `hasGeneric`,
não pra ausência de vídeo.

**REVISADO em `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md` (achado 1): nessa configuração a barra mínima não some mais por
inatividade.** O auto-hide pressupõe que dá pra trazer a barra de volta movendo o mouse sobre o
player, e em `GENERIC_IFRAME` isso é falso: a área toda é um iframe cross-origin, e a camada de
captura de ponteiro de `docs/specs/01-fundacao-mvp/spec.md`, seção 7, não pode ser montada aqui — ela bloquearia justamente o clique dentro
do iframe, que nessa fonte é o único jeito de controlar a reprodução. Escondida, a barra mínima
ficava inalcançável e com ela o único caminho até o modo teatro. Hoje `alwaysVisible =
!controller && showFullscreenOnly` (`PlayerShell.tsx:71`) mantém o botão renderizado o tempo todo em
`opacity-60`, subindo pra `opacity-100` em `hover`/`focus-within` (`:113`) — mesmo tratamento que a
9.2 já dá ao cluster de `RoomActions` em tela cheia sem teatro, pelo mesmo motivo (é o único caminho
de volta). Fontes com controller seguem com auto-hide normal.
