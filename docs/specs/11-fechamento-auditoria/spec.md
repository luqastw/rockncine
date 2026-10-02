# 11 — Fechamento da auditoria

Fecha os achados de uma revisão de código e UI/UX sobre o estado pós-deploy das specs 01 a 10. Nenhum
item é novo produto: todos são defeito, regressão, inconsistência ou ausência de defence num código
que já funciona.

## 1. Problema

Dez itens, em três classes:

1. **Confiabilidade da sala inteira a partir de um único cliente.** Um broadcast com `text` não-string
   derrubava o React em cada participante; um `ts` no futuro congelava o sync de todo mundo de forma
   permanente. Não havia `error.tsx` no segmento da sala, então não havia nem contenção.
2. **Peso e re-render.** `hls.js` e o SDK do Vimeo entravam no chunk da rota para toda sala, inclusive
   as de YouTube. O playhead morava em `useState` dentro dos hooks de sync, e cada tick reconcilia a
   árvore inteira.
3. **Ausências.** Legendas sem volta, trap de foco duplicado, rotas de escrita sem limite nem checagem
   de origem, lista de salas que ordenava pela métrica errada e sumia com a 21ª sala, raiz do site sem
   superfície pública.

## 2. Objetivos

- Nenhum payload de broadcast malformado, de qualquer membro, derruba ou degrada a sala.
- Um `ts` implausível não afeta ninguém além de quem o emitiu.
- O payload inicial de `/rooms/[code]` não carrega player que a sala não usa.
- O playhead re-renderiza só quem mostra o playhead.
- Toda rota de escrita tem checagem de origem e rate limit.
- Toda âncora de spec citada pelo código é verificada, inclusive em `.css`.

## 3. Não-objetivos

- **Não** é uma migração de stack. Avaliada e recusada: o backend são 626 linhas e um POST para o
  Liveblocks; a migração para Laravel entregaria ganho técnico próximo de zero por um rewrite do frontend.
- **Não** substitui o player nativo do YouTube/Vimeo. Nenhuma customização de seek, buffer ou ABR
  interno dos SDKs.
- **Não** introduce picture-in-picture nem controle de velocidade. Ausências de produto, não de
  correção, e não foram pedidas.
- **Não** fecha uma CSP. Ver seção 7.
- **Não** cria cron para expurgo de `RoomMember`. A tabela cresce a cada visita; resolver isso é
  decisão de produto sobre quando uma sala "expira".

## 4. Requisitos funcionais

### Validação de payload

- **FR-001** QUANDO um broadcast de `CHAT_MESSAGE` ou `SYSTEM_MESSAGE` chegar, ENTÃO o payload DEVE
  passar por `parseChatEvent` antes de entrar no feed, e o resultado DEVE ser `null` para: payload não
  objeto, `type` desconhecido, `id` ausente/vazio/> 64, `text` não-string/> 500, `authorId` não-string
  em mensagem de chat, `authorName` não-string/> 64, `ts` não finito ou fora da banda.
- **FR-002** QUANDO o usuário local enviar mensagem, ENTÃO o texto DEVE ser cortado em 500 caracteres
  antes do broadcast, de modo que a UI nunca produza um payload que o validador descartaria.
- **FR-003** QUANDO o texto de uma mensagem de sistema de "saiu da sala" for montado a partir da
  presence de outro cliente, ENTÃO ele DEVE passar pelo mesmo validador.
- **FR-004** QUANDO um erro de render ocorrer dentro de `/rooms/[code]`, ENTÃO o boundary
  `app/rooms/[code]/error.tsx` DEVE conter a falha e DEVE oferecer "tentar de novo" (`retry`) e um link
  para `/rooms` — sem remover a pessoa da sala.

### Plausibilidade do relógio

- **FR-005** QUANDO um evento de player chegar, ENTÃO `parsePlayerEvent` DEVE rejeitar `ts` com
  `|ts - Date.now()| > 30 s`, e DEVE continuar aceitando `ts` até 5 s no passado (latência normal de
  rede).
- **FR-006** QUANDO nenhuma amostra de desvio do ator existir, ou a última amostra for mais antiga que
  10 minutos, ENTÃO `skewFor` DEVE devolver 0.
- **FR-007** QUANDO uma amostra de desvio com `|observado| > 30 s` chegar, ENTÃO `updateSkew` DEVE
  descartá-la.
- **FR-008** QUANDO a primeira amostra de um ator for NEGATIVA (relógio de quem age adiantado), ENTÃO
  ela DEVE ser aceita — o valor de comparação é "sem amostra anterior", não 0.

### Peso e re-render

- **FR-009** QUANDO uma sala não estiver tocando `.m3u8`, ENTÃO o chunk de `hls.js` NÃO DEVE estar no
  payload inicial de `/rooms/[code]`.
- **FR-010** QUANDO uma sala não estiver tocando vídeo do Vimeo, ENTÃO o chunk de `@vimeo/player` NÃO
  DEVE estar no payload inicial de `/rooms/[code]`.
- **FR-011** QUANDO `currentTime` mudar, ENTÃO somente os componentes que assinam `useCurrentTime`
  DEVEM re-renderizar; `Chat`, `PresenceList` e `SyncRing` NÃO DEVEM.
- **FR-012** QUANDO o player sair da sala, ENTÃO o relógio DE playback DEVE ser zerado, para que a
  próxima sala não leia o playhead da anterior no primeiro render.
- **FR-013** QUANDO o limite de FPS for desligado, ENTÃO `maxMaxBufferLength` DEVE voltar ao default do
  hls.js (600), e NÃO a `undefined`.

### Legendas

- **FR-014** QUANDO a fonte for YouTube, ENTÃO a barra DEVE oferecer um botão de legenda com
  `aria-pressed`, default desligado, que persists em `localStorage` e alterna em runtime sem recarregar
  o vídeo.
- **FR-015** QUANDO a fonte NÃO for YouTube, ENTÃO o botão de legenda NÃO DEVE ser renderizado.

### Rotas de escrita

- **FR-016** QUANDO `PATCH /rooms/[code]/video` receber `Origin` de host divergente, ENTÃO DEVE
  responder 403 ANTES de qualquer leitura de sessão.
- **FR-017** QUANDO `PATCH /rooms/[code]/video` passar de 20 requisições na janela de 60 s para a mesma
  origem, ENTÃO DEVE responder 429 com `Retry-After`, ANTES de `resolveVideoUrl` e do `room.update`.
- **FR-018** QUANDO `POST /rooms/new` receber `Origin` de host divergente, ENTÃO DEVE responder 403.
- **FR-019** QUANDO `POST /rooms/new` passar de 10 requisições na janela de 60 s, ENTÃO DEVE responder
  429.

### Lista de salas e raiz

- **FR-020** QUANDO a lista de salas for consultada, ENTÃO a ordenação DEVE ser por
  `room.updatedAt desc`, e não por `membership.joinedAt`.
- **FR-021** QUANDO a sala tiver vídeo carregado, ENTÃO o card DEVE exibir a fonte; quando não tiver,
  DEVE exibir só o código, sem separador pendurado.
- **FR-022** QUANDO houver mais de 20 salas, ENTÃO a página DEVE oferecer link para a próxima, e o
  item 21 DEVE servir apenas de sinal, sem ser renderizado.
- **FR-023** QUANDO `pagina` for não numérica ou ≤ 0, ENTÃO a consulta DEVE usar `skip: 0`.
- **FR-024** QUANDO a raiz `/` for acessada sem sessão, ENTÃO DEVE renderizar página pública com o
  passo a passo e os links para criar conta e entrar.
- **FR-025** QUANDO a raiz `/` for acessada com sessão, ENTÃO DEVE redirecionar para `/rooms`.

### Cabeçalhos e âncoras

- **FR-026** QUANDO qualquer rota responder, ENTÃO DEVE incluir `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`; em produção, também HSTS. E
  `X-Powered-By` NÃO DEVE estar presente.
- **FR-027** QUANDO o layout raiz renderizar, ENTÃO DEVE emitir `themeColor` e metadados `openGraph` e
  `twitter` para o preview de link de convite.
- **FR-028** QUANDO o código citar `docs/specs/<pasta>/<arquivo>.md` a partir de um arquivo `.ts`,
  `.tsx` **ou `.css`**, ENTÃO `anchors.test.ts` DEVE coletar a referência e falhar se a âncora não
  existir.

## 5. Critérios de aceite

- **AC-001** Dado um broadcast `CHAT_MESSAGE` com `text` sendo um objeto, quando ele chega ao
  `useChat`, então nenhuma mensagem é adicionada ao feed, `render` não lança, e a tela permanece
  montada.
- **AC-002** Dado um broadcast com `ts = Date.now() + 60_000`, quando `parsePlayerEvent` o processa,
  então o retorno é `null`.
- **AC-003** Dado `ts = Date.now() - 5_000`, quando `parsePlayerEvent` o processa, então o retorno é um
  evento com o `ts` preservado.
- **AC-004** Dado um `ts = Date.now() + 60_000` injetado direto no broadcast, sem passar pelo parser
  — o que um cliente malicioso pode fazer, porque o Liveblocks retransmite o payload sem inspecioná-lo
  —, quando um evento legítimo de `Date.now()` chega depois, então `shouldApplyPlayerEvent` o
  descarta. Isto documenta o **defeito residual**: o last-write-wins confia no `ts` do remetente e a
  banda de plausibilidade só age no parser, que o cliente não é obrigado a usar. A defesa completa
  exige timestamp autoritativo no servidor ou arbitragem por `actorId`, que é mudança de protocolo.
- **AC-005** Dado `updateSkew({}, "b", 1_000, 4_000)`, quando a primeira amostra do ator é negativa,
  então o resultado contém `b` com skew `-3000`.
- **AC-006** Dado `skewFor({ a: { skew: 240_000, at: 1_000 } }, "a", 1_000 + SKEW_TTL_MS + 1)`, quando
  a amostra está vencida, então o retorno é `0`.
- **AC-007** Dado um `<video>` tocando, quando 3 ticks de `timeupdate` ocorrem, então o contador de
  render de um componente que assina `useCurrentTime` cresce e o de um que não assina permanece igual.
- **AC-008** Dado `setMaxBufferLength(hls, 2)` seguido de `setMaxBufferLength(hls, null)`, quando o
  valor é lido, então é `600`, e `Math.min(30, valor)` não é `NaN`.
- **AC-009** Dado uma sala de YouTube com legenda desligada, quando o botão de legenda é renderizado,
  então `aria-pressed` é `false`; quando clicado, `aria-pressed` passa a `true` e `localStorage` guarda
  `captions: true`.
- **AC-010** Dado uma sala de mídia direta, quando a barra de controles renderiza, então não existe
  botão com `aria-label` começando por "ativar legenda".
- **AC-011** Dado `ConfirmDialog` aberto, quando o foco está no último botão e `Tab` é pressionado,
  então `defaultPrevented` é `true` e o foco vai para o primeiro botão do painel.
- **AC-012** Dado `PATCH /rooms/[code]/video` com `Origin: https://exemplo.invalido`, quando a rota é
  chamada, então o status é 403 e `getServerSession` não foi chamado.
- **AC-013** Dado 21 requisições PATCH da mesma origem, quando a 21ª é feita, então o status é 429 e
  `resolveVideoUrl` não foi chamado.
- **AC-014** Dado `POST /rooms/new` com `Origin` divergente, quando a rota é chamada, então o status é
  403.
- **AC-015** Dado um usuário com 25 salas, quando `/rooms` renderiza, então a consulta tem
  `take: 21, skip: 0`, o card da 21ª sala não aparece, e existe link "mais →" com `?pagina=2`.
- **AC-016** Dado `/rooms?pagina=abc`, quando a página renderiza, então a consulta tem `skip: 0`.
- **AC-017** Dado um `RoomMember` com `joinedAt` de 8 meses atrás para uma sala com `updatedAt` de
  hoje, quando `/rooms` renderiza, então a ordem pedida ao banco é `{ room: { updatedAt: "desc" } }`.
- **AC-018** Dado um visitante sem sessão, quando ele acessa `/`, então a resposta contém "criar conta"
  e "já tenho conta", e NÃO contém redirect para `/rooms`.
- **AC-019** Dado uma resposta de qualquer rota, quando ela é inspecionada, então
  `x-powered-by` está ausente e `x-frame-options` é `DENY`.
- **AC-020** Dado `app/globals.css` citando `docs/specs/03-auditoria-ui-ux/spec.md` com uma âncora
  numérica que não existe mais naquela spec, quando a suíte roda, então ela falha.
- **AC-021** Dado o build de produção, quando se mede o payload inicial de `/rooms/[code]`, então ele é
  ≤ 120 KB gzip e não contém o chunk de `hls.js` nem o de `@vimeo/player`.

## 6. NFRs

- **NFR-001** Payload JavaScript inicial de `/rooms/[code]`: ≤ 120 KB gzip (medido: 107,6 KB; era
  278,3 KB).
  **Revogado pela spec 12**, que adiciona o cliente de SFU (LiveKit) à rota da sala e leva o número
  a 260,1 KB gzip. O teto de 120 KB foi cumprido e medido no escopo desta spec; a regressão é
  documentada, medida e explicada em `docs/specs/12-transmissao-screen-share/spec.md`, seção 9 —
  inclusive a alternativa que a mitigaria e por que ela não foi escolhida. As demais rotas
  (`/`, `/login`, `/register`, `/rooms`) seguem fora dele.
- **NFR-002** Ticks de playhead por segundo: 4 (inalterado). Renderizações da árvore da sala por
  tick: 0.
- **NFR-003** Custo de `parseChatEvent` e `parsePlayerEvent`: O(1), sem alocação além do objeto
  devolvido.
- **NFR-004** Adição ao gate: 0 dependências.

## 7. Riscos e decisões rejeitadas

### CSP não fechada

O produto embute iframe de `http/https` arbitrário (`GENERIC_IFRAME`) e roda o script do player do
YouTube. Uma `script-src` fechada quebraria ambos. O vetor de XSS já está fechado na origem:
`isSafeEmbedUrl` valida o protocolo no ponto de renderização (não só no servidor), e todo payload de
broadcast passa por validação de formato. Fechar a CSP depende de inventariar as origens permitidas,
e esse inventário não existe. Decisão: não fazer agora; o `Permissions-Policy` já limita o que um
embed de terceiro pode acessar.

### `Date.now()` do cliente continua autoritativo

O `ts` do last-write-wins vem do remetente. A banda de 30 s (FR-005) rejeita o óbvio no parser, mas
um cliente malicioso pode emitir qualquer `ts` que o server não valida — o Liveblocks retransmite o
payload sem inspecioná-lo. O estado alcançável é: um membro pode congelar o sync dos outros até
reconectar (AC-004). Fechar isso exige timestamp autoritativo no servidor ou medianeira por
`actorId`, que é mudança de protocolo. Registrado como dívida, não escondido.

### `RoomMember` sem expurgo

O `upsert` no layout acontece a cada visita e a linha nunca é removida; a lista pagina em vez de
resolver. A página pública resolve a entrada acidental por link de convite, mas a limpeza precisa de
uma política de expiração — decisão de produto.

### Módulo de legendas do YouTube

`loadModule`/`unloadModule` são a única API pública de legenda da IFrame Player API. Não há seleção
de faixa — o YouTube escolhe a preferida e a lista fica no botão nativo que o módulo habilita. A
IFrame API não expõe escolha programática de faixa; um seletor próprio exigiria ler `getOption` e
reimplementar o menu.

## 8. Onde está o quê

| Mudança | Arquivo |
|---|---|
| Validador de chat | `lib/chat-event.ts` |
| Banda de plausibilidade do `ts` | `lib/playback/events.ts` |
| TTL e reset de skew | `lib/playback/clock.ts` |
| Boundary da sala | `app/rooms/[code]/error.tsx` |
| Tipos + import sob demanda do hls.js | `lib/hls.ts` |
| Tipos + import sob demanda do Vimeo | `lib/vimeo.ts` |
| Store do playhead | `hooks/usePlaybackClock.ts` |
| Legenda | `hooks/useYouTubeSync.ts`, `useVideoQuality.ts`, `PlayerControls.tsx`, `icons.tsx` |
| Trap de foco | `hooks/useFocusTrap.ts` |
| Checagem de origem | `lib/request.ts` |
| Rate limit e origem nas escritas | `app/rooms/[code]/video/route.ts`, `app/rooms/new/route.ts` |
| Lista de salas | `app/rooms/page.tsx`, `lib/video-source.ts` (`SOURCE_LABEL`) |
| Página pública | `app/page.tsx` |
| Cabeçalhos e metadados | `next.config.ts`, `app/layout.tsx` |
| Âncoras em CSS | `docs/specs/anchors.test.ts`, `app/globals.css` |
