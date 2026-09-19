# Spec: auditoria UI/UX — rodada 2

**Status:** implementado (com ressalvas)
**Pesquisa:** `research.md`

## 1. Problema / motivação

A segunda passada de auditoria rodou o app no navegador e mediu o DOM real (`getBoundingClientRect`,
`elementFromPoint`, `getComputedStyle`, `MutationObserver`) em vez de inferir comportamento do
código. Ela encontrou 28 defeitos priorizados P0/P1/P2, que esta rodada corrigiu — parte com desvio
em relação à correção proposta no plano. Os três P0 mais graves só aparecem em tempo de execução:
quem abre o player com fonte de iframe cross-origin perde a barra de controles depois do auto-hide,
perde a tela cheia sob o overlay de pausa e não tem caminho de teclado até o player.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Manter a barra de controles do player alcançável por ponteiro e por teclado em toda fonte:
   iframes cross-origin, mídia direta e iframe genérico.
2. Manter player e chat dentro da viewport sem rolagem de página, no desktop e na largura estreita.
3. Dar caminho de convite, de saída da sala, de saída da conta e de reencontro das salas.
4. Manter o estado da sala honesto: badge, posição, estado vazio e última ação espelham o que está
   acontecendo.
5. Fechar os pisos de contraste de contorno (≥ 3:1), de anel de foco e de nome acessível.

**Não-objetivos**

- Reabrir a decisão de controle compartilhado do player (qualquer pessoa controla).
- Instalar família tipográfica nova: "Display" segue sendo peso, tamanho e tracking sobre a mesma
  sans.
- Migrar os hooks de sync para a API `@liveblocks/react/suspense` — o `ClientSideSuspense`, caminho
  idiomático, exigiria refatoração desproporcional ao problema.
- Corrigir os itens 3, 4 e 6 da seção 9.3 da spec 02 (drift, cooldown e `overflow-hidden` na caixa
  do vídeo) — continuam sem medição e sem correção.
- Testar em dispositivo real de 390px: a verificação dos achados 9 e 22 emulou as regras CSS numa
  janela larga.

## 3. Histórias de usuário

- **US-1**: Como quem assiste a um vídeo de YouTube/Vimeo, quero reencontrar play/pause, scrubber,
  volume e tela cheia depois do auto-hide, para não depender do chrome nativo do embed.
- **US-2**: Como quem navega só por teclado, quero alcançar os controles do player, para operar o
  player sem mouse.
- **US-3**: Como quem cria uma sala, quero convidar alguém por um código curto e um link copiável,
  para não ditar 25 caracteres.
- **US-4**: Como quem reabre uma sala depois de um tempo, quero ver o estado real (tocando/pausado)
  e a posição correta, para não ser enganado pelo badge.
- **US-5**: Como quem usa tela estreita, quero que o vídeo e o chat caibam juntos na tela, para não
  rolar a página inteira para tocar no vídeo.
- **US-6**: Como quem usa leitor de tela ou só teclado, quero nomes acessíveis, anúncios de erro e
  anéis de foco visíveis.

## 4. Requisitos funcionais (EARS)

### Player: alcance e camadas

- **FR-001** O sistema DEVE manter, sobre a área do player de fonte com `PlaybackController`, uma
  camada transparente que recebe os eventos de ponteiro do wrapper. (achado 1)
- **FR-002** O sistema NÃO DEVE montar a camada de captura de ponteiro sobre `GENERIC_IFRAME`; para
  essa fonte DEVE exibir a barra de controles sem auto-hide. (achado 1)
- **FR-003** O sistema DEVE empilhar as camadas do player com z-index explícito: captura de ponteiro
  em `z-10`, overlay de pausa em `z-20` e barra de controles em `z-30`. (achado 2)
- **FR-004** ENQUANTO a barra de controles estiver escondida pelo auto-hide, o sistema DEVE manter
  seus controles na ordem de tabulação, e QUANDO qualquer controle receber foco, DEVE revelar a
  barra. (achado 3)
- **FR-005** O sistema DEVE limitar a altura da caixa do vídeo também fora da tela cheia, de modo
  que a página não tenha rolagem vertical e a moldura de sync continue contornando o vídeo.
  (achado 4)
- **FR-006** SE `document.fullscreenEnabled` for falso, ENTÃO o sistema DEVE oferecer tela cheia por
  CSS (stage `fixed inset-0 z-50`), e QUANDO Escape for pressionado DEVE sair dela. (achado 19)

### Entrada de link

- **FR-007** SE o link colado não tiver esquema, ENTÃO o sistema DEVE tentar `https://` antes de
  recusar, e NÃO DEVE aceitar o palpite quando o hostname não contiver ponto. (achado 5)
- **FR-008** O campo de link do modal DEVE declarar `inputMode="url"`, `autoComplete="off"`,
  `autoCapitalize="off"` e `spellCheck={false}`. (achado 5)

### Convite e navegação

- **FR-009** QUANDO uma sala for criada, o sistema DEVE atribuir um código de 8 caracteres de um
  alfabeto sem `0`/`O`, `1`/`I`/`L` e `U`; SE a criação colidir em código (`P2002`), ENTÃO DEVE
  gerar novo código, até 5 tentativas, e depois cair no `@default(cuid())`. (achado 6)
- **FR-010** QUANDO o usuário acionar o convite, o sistema DEVE copiar `${origin}/rooms/${code}` e
  exibir a confirmação "link copiado"; SE o clipboard for negado, ENTÃO DEVE selecionar o texto como
  fallback. (achado 6)
- **FR-011** O sistema DEVE resolver a sala com o código digitado em qualquer caixa, mantendo
  `Room.code` canônico no link e no `roomId` do Liveblocks. (achado 6)
- **FR-012** O sistema DEVE oferecer, no header da sala, link de volta para `/rooms`; e no header de
  `/rooms`, botão de sair e a lista das 20 salas mais recentes do usuário, marcando as próprias com
  "sua". (achado 7)

### Sync e estado da sala

- **FR-013** QUANDO o scrubber for alterado por teclado ou perder o foco, o sistema DEVE buscar a
  posição no vídeo e zerar o estado de arraste, e DEVE anunciar o valor no formato "m:ss de m:ss".
  (achado 8)
- **FR-014** QUANDO uma sala for reaberta, o sistema DEVE calcular a posição esperada com clamp pela
  duração e descartar snapshots mais antigos que 5 minutos. (achado 10)
- **FR-015** O badge "ao vivo" e o `SyncRing` DEVEM ler o estado do controller ativo; e QUANDO
  `pagehide` disparar sem outros participantes (`othersCount === 0`), o sistema DEVE gravar
  `isPlaying: false`. (achado 10)
- **FR-016** ENQUANTO o storage do Liveblocks não estiver sincronizado, o sistema DEVE renderizar
  skeleton, e NÃO DEVE renderizar o estado "nenhum vídeo carregado". (achado 11)

### Layout estreito

- **FR-017** Abaixo de `lg`, o sistema DEVE manter a página como casca de altura fixa (`h-dvh`,
  `overflow-hidden`), com o vídeo limitado a `38dvh` e o log do chat com rolagem própria.
  (achado 9)

### Contraste, tipografia e progresso

- **FR-018** Os contornos de campo de formulário e do botão "entrar" DEVEM ter razão de contraste de
  pelo menos 3:1 sobre `--bg-void`. (achado 12)
- **FR-019** O título da sala DEVE usar o papel Display (`text-lg font-semibold tracking-tight`),
  sem família tipográfica nova. (achado 20)
- **FR-020** O scrubber e o slider de volume DEVEM pintar a parte reproduzida numa faixa visível
  contra o fundo escuro, sem o track padrão do browser, preservando a área de toque. (achado 13)

### Chat e anúncios

- **FR-021** O sistema DEVE colar o chat no rodapé apenas quando a lista estiver a menos de 48px do
  fim; fora disso DEVE exibir "novas mensagens ↓"; enviar mensagem DEVE re-colar. (achado 14)
- **FR-022** Erros DEVEM ser anunciados em elemento com `role="alert"`, e mudanças de conexão ou de
  pausa em elemento com `role="status"` e `aria-live="polite"`. (achado 15)

### Formulários e acessibilidade

- **FR-023** Os campos de login e cadastro DEVEM declarar `autoComplete` (`email`,
  `current-password`, `new-password`, `name`). (achado 16)
- **FR-024** Os campos sem `<label>` visível DEVEM ter nome acessível (`aria-label` ou `<label>` com
  `htmlFor` `sr-only`). (achado 21)
- **FR-025** Abaixo de `sm`, a barra de controles DEVE omitir o slider de volume e a duração total,
  com `gap` e `padding` reduzidos. (achado 22)
- **FR-026** O botão de play sobre o vídeo pausado DEVE exibir anel de foco visível
  (`focus-visible:ring-4` com `ring-inset`); e os anéis de foco DEVEM usar o offset da superfície
  vigente (`--focus-offset`). (achados 17, 24)
- **FR-027** O `<iframe>` genérico DEVE ter `title="player de vídeo incorporado"`. (achado 18)

### Shell, badge e presença

- **FR-028** O sistema DEVE ter `loading.tsx` para `/rooms/[code]`, `error.tsx` e estado de
  pendência que desabilite o envio do formulário de criação de sala. (achado 23)
- **FR-029** O `<main>` da sala DEVE reservar `pb-14` para o badge obrigatório do Liveblocks, e esse
  valor DEVE entrar no desconto do teto de altura do vídeo. (achado 25)
- **FR-030** A lista de presença DEVE deduplicar por `presence.userId` e exibir "N na sala".
  (achado 26)

### Atalhos e última ação

- **FR-031** QUANDO o foco não estiver em campo editável (`input`/`textarea`/`contenteditable`) nem
  houver modal aberto, o sistema DEVE responder a: espaço e `k` (play-pause), `←` e `→` (±5s),
  `m` (mudo) e `f` (tela cheia). (achado 27)
- **FR-032** O sistema DEVE exibir, abaixo do título da sala, uma nota com a última ação de player
  ("fulano pausou / deu play / mudou a posição / carregou um vídeo"), que some após 6s. (achado 28)

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário. Cenários infelizes primeiro quando a spec original os trata.

### Alcance do player

- **AC-001** [FR-002] Given uma fonte `GENERIC_IFRAME`, When o player é renderizado, Then não existe
  camada de captura sobre o iframe e a barra de controles está visível sem auto-hide.
- **AC-002** [FR-001] Given uma fonte `YOUTUBE`, When passam 2500 ms após o play, Then
  `elementFromPoint` no centro do player devolve a camada de captura (não `IFRAME`) e um `mousemove`
  real devolve a barra a `opacity: 1`.
- **AC-003** [FR-003] Given a barra sobre o overlay de pausa do YouTube, When `elementFromPoint` é
  medido no centro do botão de tela cheia, Then o elemento devolvido é o botão da barra (`z-30`),
  não o overlay (`z-20`).
- **AC-004** [FR-004] Given o auto-hide acionado, When `Tab` é pressionado a partir do `body`, Then o
  foco chega a um controle do player e a barra fica com `opacity: 1` e `pointer-events: auto`.
- **AC-005** [FR-005] Given viewport de 810px de altura, When a sala carrega com vídeo, Then
  `document.scrollHeight == innerHeight` e o rodapé do vídeo está acima da dobra.
- **AC-006** [FR-006] Given `document.fullscreenEnabled === false`, When o usuário aciona tela
  cheia, Then o stage fica `fixed inset-0 z-50`; When Escape é pressionado, Then volta ao layout
  normal.

### Entrada de link

- **AC-007** [FR-007] Given o valor `youtu.be/aqz-KE-bpKQ` (sem esquema), When `POST
  /api/resolve-embed` é chamado, Then a resposta é `200` com `source = "YOUTUBE"`.
- **AC-008** [FR-007] Given o valor `filme legal` (sem esquema e sem ponto no host), When o link é
  submetido, Then a resposta é `422` com `{"error":"link inválido."}`.
- **AC-009** [FR-008] Given o modal de carregar link, When o campo é inspecionado, Then tem
  `inputmode="url"`, `autocomplete="off"`, `autocapitalize="off"` e `spellcheck="false"`.

### Convite e navegação

- **AC-010** [FR-009] Given 5 colisões consecutivas de `code` (`P2002`), When uma sala é criada,
  Then o código persistido é o `cuid` de 25 caracteres e a sala abre.
- **AC-011** [FR-009] Given uma sala recém-criada, When o código é lido, Then tem 8 caracteres e
  nenhum deles é `0`, `O`, `1`, `I`, `L` ou `U`.
- **AC-012** [FR-010] Given um contexto sem permissão de clipboard, When o convite é acionado, Then o
  texto `${origin}/rooms/${code}` é selecionado como fallback.
- **AC-013** [FR-010] Given permissão de clipboard, When o convite é acionado, Then o clipboard
  contém `${origin}/rooms/${code}` e aparece a confirmação "link copiado".
- **AC-014** [FR-011] Given uma sala de `Room.code = "ABCD2345"`, When `/rooms/abcd2345` é aberto,
  Then a mesma sala é resolvida (mesmo `roomId` no Liveblocks) e nenhuma sala nova é criada.
- **AC-015** [FR-012] Given a sala e `/rooms` logados, When os headers são renderizados, Then a sala
  tem link para `/rooms`, e `/rooms` tem botão de sair e a lista das 20 salas mais recentes com a
  marca "sua" nas próprias.

### Sync e estado

- **AC-016** [FR-013] Given o scrubber focado, When `ArrowRight` é pressionado, Then o `currentTime`
  do vídeo muda e o valor anunciado é "m:ss de m:ss".
- **AC-017** [FR-014] Given um snapshot com `updatedAt` de 10 minutos atrás, When um cliente entra na
  sala, Then a posição aplicada não passa da duração do vídeo e o snapshot é descartado.
- **AC-018** [FR-015] Given o último participante saindo durante a reprodução (`othersCount === 0`),
  When `pagehide` dispara, Then o storage registra `isPlaying: false` e a próxima abertura mostra
  "pausado".
- **AC-019** [FR-016] Given uma sala com vídeo salvo, When o primeiro paint ocorre antes da
  sincronização do storage, Then o HTML contém "carregando a sala" e não contém "nenhum vídeo
  carregado".

### Layout estreito

- **AC-020** [FR-017] Given largura abaixo de `lg` e viewport de 810px, When a sala carrega, Then não
  há rolagem de página, o vídeo mede ≤ `38dvh` e o log do chat tem `overflow-y: auto`.

### Contraste, tipografia e progresso

- **AC-021** [FR-018] Given um contorno de campo com `--ink-muted`, When a cor é medida sobre
  `--bg-void`, Then a razão de contraste é ≥ 3:1.
- **AC-022** [FR-019] Given `/login` e `/rooms`, When os `h1` são medidos, Then ambos têm o mesmo
  `font-weight` e o mesmo `letter-spacing`.
- **AC-023** [FR-020] Given o scrubber com metade da faixa reproduzida, When o background é medido,
  Then a parte reproduzida tem `linear-gradient` e os pseudo-elementos de track têm fundo
  transparente.

### Chat e acessibilidade

- **AC-024** [FR-021] Given o usuário a mais de 48px do fim do log, When uma mensagem nova chega,
  Then o `scrollTop` não muda e aparece "novas mensagens ↓".
- **AC-025** [FR-022] Given um erro de login, When o bloco de erro é renderizado, Then tem
  `role="alert"`; Given o rótulo de conexão mudando, When ele muda, Then tem `role="status"` e
  `aria-live="polite"`.
- **AC-026** [FR-023] Given `LoginForm` e `RegisterForm`, When o HTML é inspecionado, Then os
  `autocomplete` são `email`, `current-password`, `new-password` e `name`.
- **AC-027** [FR-024] Given o campo de mensagem do chat, When o nome acessível é consultado, Then ele
  é não vazio e não depende do placeholder.
- **AC-028** [FR-025] Given viewport de 360px, When a barra é renderizada, Then o slider de volume e
  a duração total não existem no DOM e a barra não transborda.
- **AC-029** [FR-026] Given o botão de play sobre o vídeo pausado focado, When o foco é medido, Then
  há anel visível com `ring-inset`; e o anel do `aside` em modo teatro usa o offset da superfície
  clara.
- **AC-030** [FR-027] Given o iframe genérico, When ele é inspecionado, Then tem
  `title="player de vídeo incorporado"`.

### Shell, badge e presença

- **AC-031** [FR-028] Given o formulário de criação, When o envio está em andamento, Then o botão
  está `disabled`; e Given `/rooms/{code}` carregando, Then `loading.tsx` é exibido.
- **AC-032** [FR-029] Given a sala com o badge do Liveblocks, When a geometria é medida, Then o badge
  está inteiramente abaixo da caixa do vídeo.
- **AC-033** [FR-030] Given a mesma pessoa em duas abas, When a lista de presença é renderizada, Then
  ela aparece uma vez e o rótulo mostra "N na sala".

### Atalhos e última ação

- **AC-034** [FR-031] Given o foco num `<input>` do chat, When `f` é pressionado, Then o caractere é
  inserido e a tela cheia não é acionada.
- **AC-035** [FR-031] Given o foco fora de campo editável e sem modal, When `m` é pressionado, Then o
  vídeo é silenciado.
- **AC-036** [FR-032] Given um evento de player (ex. pause), When a nota é renderizada, Then o texto
  com o nome de quem pausou aparece abaixo do título e some após 6s.

## 6. Requisitos não-funcionais (quantificados)

- **Tempo de auto-hide:** a barra de controles do player some após 2500 ms de inatividade e volta ao
  primeiro `mousemove` real ou ao foco (AC-002, AC-004).
- **Sem rolagem:** com viewport de 810px, o `document.scrollHeight` da sala é igual ao `innerHeight`
  (0 px de rolagem) no desktop (AC-005) e abaixo de `lg` (AC-020).
- **Altura do vídeo no mobile:** ≤ `38dvh`; abaixo de `sm`, a barra omite volume e duração total e
  não transborda os ~296px úteis de um viewport de 360px (AC-020, AC-028).
- **Contraste:** contorno de campo ≥ 3:1 sobre `--bg-void` (WCAG 1.4.11) (AC-021).
- **Staleness de sincronização:** snapshots com mais de 5 minutos (300000 ms) são descartados
  (AC-017).
- **Progresso:** a faixa reproduzida é pintada em 4px de altura dentro de uma área de toque de 44px
  (AC-023).
- **Chat e atalhos:** pin no fim em 48px; a nota da última ação some em 6s; o passo de seek é 5s e o
  auto-hide é 2500 ms (AC-024, AC-036, AC-016, AC-002).
- **Reserva do badge:** `pb-14` (2,5rem) no `<main>`, somando ao desconto de 10rem no teto de altura
  (AC-032).

## 7. Dados e contratos

- **Schema:** `Room.code` continua `String @unique`; nenhuma migração. O valor passa a ser gerado por
  `lib/room-code.ts` (8 caracteres) no `create`, com retentativa em `P2002` e queda no
  `@default(cuid())`.
- **Lista de salas:** leitura de `RoomMember` por `userId`, `orderBy: joinedAt desc`, `take: 20`;
  `ownerId` marca "sua".
- **Storage do Liveblocks:** `isPlaying`, `updatedAt` e `lastActorId`; `expectedPlaybackTime()`
  (`hooks/playerController.ts`) é a fonte do cálculo de posição esperada.
- **Tokens CSS:** `--ink-muted` (contorno), `--line` (divisor/moldura, isento do 1.4.11),
  `--focus-offset` (default `--bg-void`, redefinido no `aside` em modo teatro), `--scrim`,
  `--bg-void`, `--bg-surface`.
- **Sem endpoint novo. Sem dependência nova.**

## 8. Riscos / dependências

- **Dependência da spec 05.** O achado 6 desta spec resolveu a sala por `findFirst` com
  `mode: "insensitive"`; a spec 05 (achado 1) trocou isso por duas igualdades exatas, porque o
  `mode: "insensitive"` vira `ILIKE` e tratava `%`/`_` como curinga. O contrato vigente está em
  `05-code-review-seguranca/spec.md`.
- **Pendência de verificação.** Os achados 3, 8, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 27 e 28
  foram checados só por tipo/lint/leitura; os achados 9 e 22 não foram exercitados em dispositivo
  real de 390px — a verificação emulou as regras CSS numa janela larga.
- **Fora de escopo, pendente.** Os itens 3, 4 e 6 da seção 9.3 da spec 02 seguem sem medição e sem
  correção.
- **Risco de regressão de camada.** A camada de captura (`FR-001`) depende de `PlaybackController`;
  qualquer fonte futura sem controller precisa de decisão explícita sobre `FR-002`.

## Anexo A — numeração legada (âncoras citadas pelo código)

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| achado 1 | Barra de controles inalcançável em toda fonte com iframe | FR-001, FR-002; AC-001, AC-002 | lib/rooms.ts:6 |
| achado 3 | Player inacessível por teclado | FR-004; AC-004 | components/room/PlayerLoadStatus.tsx:32 |
| achado 4 | Fora de tela cheia o vídeo não tinha teto de altura | FR-005; AC-005 | hooks/useRoomJoinAnnouncement.ts:18 |
| achado 5 | Link colado sem `https://` era rejeitado como "link inválido" | FR-007, FR-008; AC-007, AC-008, AC-009 | components/room/GenericIframe.tsx:10; lib/video-source.ts:123; app/rooms/[code]/video/route.ts:36; components/room/RoomExperience.tsx:268; components/room/RoomExperience.tsx:431 |

### Observação — âncoras apontam para esta spec, mas descrevem a spec 05 / 06

Nenhuma das citações acima usa a âncora para o conteúdo do achado correspondente **desta** spec. O
código cita o caminho `04-auditoria-ui-ux-rodada-2` mas descreve achados que vivem na
`05-code-review-seguranca` (e um na `06-consistencia-design`). A numeração original desta spec está
preservada na tabela acima; a correção das citações no código é tarefa separada e não foi feita
aqui.

- `lib/rooms.ts:6` cita **achado 1** para o *bypass de autorização via `ILIKE`/`%`* — que é o
  **achado 1 da spec 05** (`05-code-review-seguranca/spec.md`, FR-001), não o achado 1 desta spec
  (barra de controles inalcançável).
- `components/room/PlayerLoadStatus.tsx:32` cita **achado 3** para o *overlay de erro inalcançável
  depois de `isReady`* — que é o **achado 3 da spec 05** (FR-005), não o achado 3 desta spec (acesso
  por teclado); o número coincide por acaso.
- `hooks/useRoomJoinAnnouncement.ts:18` cita **achado 4** para o *anúncio "entrou na sala" nunca
  entregue* — que é o **achado 4 da spec 05** (FR-009), não o achado 4 desta spec (teto de altura).
- `components/room/GenericIframe.tsx:10`, `lib/video-source.ts:123` e
  `app/rooms/[code]/video/route.ts:36` citam **achado 5** para a *injeção de `embedUrl`* — que é o
  **achado 2 da spec 05** (FR-003, FR-004), não o achado 5 desta spec (link sem `https://`).
- `components/room/RoomExperience.tsx:268` cita **achado 5** para a *guarda de Ctrl/Cmd/Alt nos
  atalhos* — que é o **achado 5 da spec 05** (FR-010).
- `components/room/RoomExperience.tsx:431` cita "revisão de consistência, achado 5 de
  `04-auditoria-ui-ux-rodada-2`" para a *letterbox `bg-black`* — o rótulo "revisão de consistência"
  é o título da **spec 06** e o conteúdo é o item "5–14" da spec 06 (FR-006); o caminho citado
  aponta para esta spec.

Mapa de redirecionamento, para quem seguir a citação: spec 05 FR-001 ↔ `lib/rooms.ts:6`; spec 05
FR-003/FR-004 ↔ `GenericIframe.tsx:10`, `lib/video-source.ts:123`,
`app/rooms/[code]/video/route.ts:36`; spec 05 FR-005 ↔ `PlayerLoadStatus.tsx:32`; spec 05 FR-009 ↔
`useRoomJoinAnnouncement.ts:18`; spec 05 FR-010 ↔ `RoomExperience.tsx:268`; spec 06 FR-006 ↔
`RoomExperience.tsx:431`.
