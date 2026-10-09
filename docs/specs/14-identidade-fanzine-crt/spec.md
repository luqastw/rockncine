# Spec: identidade fanzine-CRT — textura, ASCII e movimento no chrome do site

**Status:** rascunho
**Pesquisa:** `research.md`
**Irmãos:** `tasks.md` (a gerar na `sdd-plan`)

---

## 1. Problema / motivação

O site é monocromático dark-first e minimalista (spec 01, seção 8). Depois de treze specs de
correção o resultado é competente e anônimo: superfície chapada, sem textura, sem movimento, sem um
gesto de marca. Quem chega por um link de convite — que é o funil inteiro do produto — vê um app que
não diz o que é.

O pedido: dar identidade sem trocar a gramática visual. Preto e branco, temática punk/rock, com a
textura de um fanzine xerocado e a crueza de um terminal ASCII (referências: o site do Hermes Agent,
da Nous Research, e o da Moonshot AI), preservando o minimalismo e o piso de acessibilidade que já
vale.

**Restrições herdadas que este redesign NÃO redecide** (spec 01, seção 8): estado nunca por matiz
(FR-044), foco visível (FR-050), `prefers-reduced-motion` desliga transição (FR-051), alvo ≥ 44px
(NFR-002), contraste de corpo ≥ 4,5:1 (NFR-001), e a regra de identidade sem matiz da spec 13
(FR-018). O redesign adiciona textura e um papel tipográfico novo; não abre exceção a nenhuma delas.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Introduzir uma camada de textura estática (grão + fio) que dê "impresso" à superfície, sem custo
   de layout.
2. Trocar o papel Display para uma mono self-hosted, aproximando a marca do vocabulário
   terminal/ASCII.
3. Prover arte ASCII decorativa como gesto de marca (hero e estados de 404/erro).
4. Adicionar movimento de entrada por viewport, contido em `opacity`/`transform`, uma vez por
   elemento.
5. Unificar o invólucro de página (largura, padding, grão) hoje repetido em cada `main`.

**Não-objetivos (out of scope explícito)**

- **Redesenhar `/rooms/[code]`** (player, chat, presença): fica para spec própria (ver 2.1).
- **Cor, variante clara ou tema controlável.** Dark-first only; a paleta não ganha matiz nem um
  segundo modo.
- **Segunda webfont.** Só a mono entra no bundle; o corpo continua na fonte do sistema.
- **Animação de scroll pinada, parallax, cursor customizado, som, vídeo de fundo.**
- **Persistir preferência de textura** em conta, banco ou `localStorage`.
- **Arte ASCII como conteúdo.** É decoração; o texto que ela ilustra vive fora dela.

### 2.1 Escopo de superfícies (vértice "da Coragem")

**Em escopo:** `/` (`app/page.tsx`), `/login`, `/register`, `/rooms`, `app/not-found.tsx`,
`app/error.tsx`, `app/global-error.tsx`, e — em `app/layout.tsx` — apenas a variável de fonte de
Display e o marcador `js` do realce progressivo. O grão e a barra de chrome vivem no invólucro de
página (`components/chrome/**`), consumido pelas telas acima; NÃO no layout raiz, que é ancestral da
sala e por isso não pode carregar textura (ver não-objetivo da sala).

**Fora de escopo:** `app/rooms/[code]/**` e `components/room/**`. A sala herda os tokens de cor
(não muda de paleta) mas **NÃO** ganha grão, ASCII, barra flutuante nem movimento nesta rodada. A
divergência entre chrome novo e sala antiga é aceita e datada; a convergência é a spec seguinte.

**Backend / dados:** nenhuma mudança em `prisma/`, `app/api/**` ou Liveblocks. O vértice "do Poder"
aqui é a ausência de requisito, declarada — não um requisito implícito.

## 3. Histórias de usuário

- **US-1**: Como visitante que abriu um link de convite, quero que a página tenha cara de produto,
  para entender em um segundo do que se trata.
- **US-2**: Como quem usa o app no celular, quero a textura sem perder legibilidade nem ganhar
  rolagem horizontal.
- **US-3**: Como quem prefere pouco movimento e menos transparência, quero que a textura e a
  animação respeitem minhas preferências do sistema.
- **US-4**: Como quem navega por teclado ou leitor de tela, quero que a arte ASCII não polua a
  árvore de acessibilidade.
- **US-5**: Como quem volta ao app, quero reconhecer a mesma linguagem entre `/`, as telas de conta
  e `/rooms`.

## 4. Requisitos funcionais (EARS)

### Cor e tokens

- **FR-001** Toda declaração de cor em `app/globals.css` DEVE ser acromática (canais R=G=B),
  preservando a regra herdada de que estado nunca é sinalizado por matiz.
- **FR-002** O sistema DEVE adicionar tokens de textura (`--grain-*`, `--hairline`, `--ascii-*`)
  SEM remover nem renomear os tokens de cor existentes (`--bg-*`, `--ink*`, `--invert-*`, `--id-*`,
  `--scrim`, `--focus-offset`).
- **FR-003** Os comentários de âncora de spec em `app/globals.css` DEVEM ser preservados ao editar o
  arquivo — `docs/specs/anchors.test.ts` é gate e falha o build quando uma citação morre.

### Tipografia

- **FR-004** O papel Display (marca e títulos de estado vazio) DEVE usar uma mono self-hosted, subset
  latin, exposta em `--font-display`, mantendo peso `font-semibold` e `tracking-tight`. *(Amenda o
  papel Display de FR-045 da spec 01, que pede "grotesk geométrico".)*
- **FR-005** A pilha de corpo DEVE continuar sendo a do sistema (`--font-sans`); o redesign NÃO DEVE
  adicionar segunda webfont.
- **FR-006** Rótulos de seção e o código de sala DEVEM continuar em mono caixa-alta com tracking
  (papel Utilitária), como já ocorre em `/rooms`.

### Textura

- **FR-007** Cada superfície em escopo DEVE ter uma camada única de grão, marcada `aria-hidden="true"`,
  com `pointer-events: none`, declarada estaticamente (sem `animation`/`transition`).
- **FR-008** SE o usuário declarar `prefers-reduced-transparency: reduce`, ENTÃO o grão e o desfoque
  DEVEM ser desligados.
- **FR-009** A arte ASCII DEVE ser decorativa: `aria-hidden="true"`, e cada texto que ela ilustra
  DEVE existir como conteúdo acessível próprio (a marca vai no `h1`, nunca só na arte).
- **FR-010** A arte ASCII DEVE caber na coluna útil de 320px: a largura de cada linha, medida com o
  avanço da mono (≤ 0,62em) a 16px, DEVE ser ≤ 272px — na prática ≤ 26 colunas. *(O rascunho dizia
  "≤ 40 colunas"; 40 colunas dão ~384px e estouram a coluna, e o AC-005 medido em colunas passava
  por vacuidade. Corrigido em 2026-10-09.)*

### Blur

- **FR-011** `backdrop-filter`/`backdrop-blur` DEVE aparecer apenas em `components/chrome/**`; NÃO
  DEVE aparecer em `components/room/**` nem em `app/rooms/**`.
- **FR-012** ENQUANTO conteúdo passar sob a barra de chrome, a barra DEVE manter separação por fio
  (`--hairline`), e não depender só do desfoque para se distinguir.

### Movimento

- **FR-013** Seções DEVEM entrar por revelação de viewport (`IntersectionObserver`), uma vez por
  elemento, animando apenas `opacity` e `transform`.
- **FR-014** O conteúdo DEVE ser visível com JavaScript ausente ou `IntersectionObserver`
  indisponível — a animação é aprimoramento, nunca portão.
- **FR-015** `prefers-reduced-motion: reduce` e o modo economy DEVEM zerar também as animações e
  transições novas; os novos seletores NÃO DEVEM escapar da regra global existente em
  `app/globals.css`.
- **FR-016** Nenhuma animação nova DEVE usar `infinite`, `animation-timeline` de scroll, ou animar
  propriedade que dispare layout (largura, altura, `border-width`, `top`/`left`).

### Superfícies

- **FR-017** A landing DEVE ter hero com a marca em Display mono, uma linha de promessa, CTA primário
  invertido, e os três passos atuais preservados.
- **FR-018** As superfícies em escopo DEVEM compartilhar um único invólucro de página (largura,
  padding, grão), substituindo as classes de `main` repetidas em cada arquivo.
- **FR-019** Os estados de 404 e de erro DEVEM usar a mesma linguagem: fio, arte ASCII decorativa e
  mono.
- **FR-020** A hierarquia de controle NÃO DEVE mudar: primário = bloco invertido
  (`--invert-bg`/`--invert-fg`); secundário = contorno `--ink-muted` → `--ink`; foco = anel duplo
  `--outline-strong` com offset `--focus-offset`.
- **FR-021** Nenhum alvo de toque novo DEVE ter menos de 44px de altura.
- **FR-022** O contraste de todo texto acessível DEVE permanecer ≥ 4,5:1. A arte ASCII decorativa
  (`aria-hidden`) é isenta: é textura de fundo, não conteúdo — o token `--ascii-ink` fica abaixo do
  piso de propósito e tem de subir se a arte deixar de ser decorativa.

## 5. Critérios de aceite (Given-When-Then)

Unhappy paths primeiro.

- **AC-001** [FR-014] Given o bundle servido sem JavaScript, When `/` é carregada, Then o `h1` e os
  três passos estão no HTML entregue, sem depender do wrapper de revelação.
- **AC-002** [FR-013, FR-014] Given um ambiente sem `IntersectionObserver`, When uma seção monta,
  Then nenhum elemento carrega classe/estilo de opacidade inicial zero.
- **AC-003** [FR-008] Given `prefers-reduced-transparency: reduce`, When a página é inspecionada,
  Then a camada de grão está desligada e o `backdrop-filter` computado da barra é `none`.
- **AC-004** [FR-015] Given `prefers-reduced-motion: reduce`, When uma seção é revelada, Then a
  duração de transição computada é ≤ 0.01ms. *(verificado em browser: `transition-duration` computada
  de `.reveal` = `1e-05s`; ver `research.md` §7.)*
- **AC-005** [FR-010] Given o módulo da arte ASCII, When o teste mede cada linha (`colunas × 0,62em ×
  16px`), Then o máximo é ≤ 272px; e a fonte não contém tabulação.
- **AC-006** [FR-007] Given a camada de grão renderizada, When o nó é inspecionado, Then tem
  `aria-hidden="true"`, `pointer-events: none` e nenhuma declaração `animation`/`transition`.
- **AC-007** [FR-009] Given `/`, When a árvore de acessibilidade é consultada, Then a arte ASCII não
  é alcançável e o nome "rockncine" está no `h1`.
- **AC-008** [FR-011] Given o repositório, When um teste varre `components/room/**` e `app/rooms/**`,
  Then há 0 ocorrências de `backdrop-filter`/`backdrop-blur`.
- **AC-009** [FR-001] Given `app/globals.css`, When um teste coleta todo hexadecimal declarado em
  variável, Then todos têm R=G=B, e a lista de infratores é vazia.
- **AC-010** [FR-002] Given os tokens das specs 01 e 13, When a folha é lida, Then `--bg-void`,
  `--bg-surface`, `--line`, `--ink`, `--ink-muted`, `--invert-bg`, `--invert-fg`, `--outline-strong`,
  `--id-1` a `--id-4`, `--scrim` e `--focus-offset` continuam declarados.
- **AC-011** [FR-017] Given `/` renderizada, When consultada por papel, Then existem o `h1`
  "rockncine", o link para `/register` e o link para `/login`, e o `ol` com 3 itens.
- **AC-012** [FR-018] Given as superfícies em escopo, When um teste varre os imports, Then todas
  importam o mesmo invólucro de página, e nenhuma mantém `main` com classe de largura própria.
- **AC-013** [FR-020] Given qualquer CTA primário em escopo, When as classes são inspecionadas, Then
  usa `--invert-bg` e `--invert-fg`, e nenhum usa matiz.
- **AC-014** [FR-021] Given todo elemento interativo novo nas superfícies em escopo, When um teste
  varre as classes, Then cada um tem `min-h-11` ou altura ≥ 44px.
- **AC-015** [FR-022] Given `--ink` sobre `--bg-void` e sobre `--bg-surface`, When a razão é medida,
  Then é ≥ 4,5:1. *(auditoria manual registrada em `research.md`.)*
- **AC-016** [FR-019] Given uma rota inexistente e um erro de segmento, When renderizados, Then ambos
  exibem fio e arte ASCII decorativa, com a marca acessível fora da arte.
- **AC-017** [escopo 2.1] Given o diff desta rodada, When ele é lido, Then `app/rooms/[code]/**` e
  `components/room/**` não aparecem (0 arquivos alterados).

## 6. Requisitos não-funcionais (quantificados)

- **Fonte:** a mono self-hosted ≤ 40 KB (woff2, subset latin); 0 requisições de webfont fora dela.
- **Movimento:** revelação ≤ 400ms, `ease-out`, uma execução por elemento; 0 animações infinitas.
- **Blur:** raio de `backdrop-filter` ≤ 12px; aplicado a ≤ 2 elementos por página, todos em
  `components/chrome/**`.
- **Textura:** grão é uma camada `position: fixed` única por página, sem animação (0 propriedades
  animadas).
- **Layout:** 0 rolagem horizontal em 320px; a arte ASCII ≤ 272px (≤ 26 colunas).
- **Acessibilidade:** `/`, `/login`, `/register`, `/rooms` passam em axe-core WCAG 2.1 AA; alvos
  ≥ 44px; contraste ≥ 4,5:1.
- **Gate:** `npm run gate` verde (typecheck + eslint + vitest + build) e `anchors.test.ts` verde.
- **Bundle:** o JS inicial de `/` não cresce mais de 5% sobre a medição atual; a arte ASCII é
  server-rendered e não adiciona JS.

## 7. Dados e contratos

- Nenhuma entidade, migração, rota de API ou contrato Liveblocks muda.
- `app/globals.css` ganha tokens de textura e `--font-display`, sem remover os tokens existentes.
- Novos componentes de chrome (nomes finais decididos na `sdd-plan`): invólucro de página, camada de
  grão, arte ASCII e wrapper de revelação. Todos server components, exceto o wrapper de revelação.
- A arte ASCII é uma constante de módulo (string multi-linha), portanto testável sem DOM.

## 8. Riscos / dependências / perguntas abertas

- **Divergência declarada com FR-045 da spec 01** (Display: grotesk geométrico → mono). O restante da
  seção 8 (FR-043, FR-044, FR-046 a FR-051) é respeitado; ver Anexo A.
- **Custo de grão + blur em aparelho fraco.** O produto tem um caso real de lag por efeito no player
  (specs 02 e 08). Mitigação: grão estático, blur só no chrome e nunca na sala, orçamento de raio, e
  desligamento em `reduced-transparency` e reduced-motion.
- **Licença e bytes da webfont.** Se a mono escolhida não tiver licença web clara ou estourar 40 KB,
  a alternativa é cair para uma mono do sistema e reduzir o gesto — decisão registrada em
  `research.md`.
- **Escopo partido.** Chrome novo e sala antiga convivem; quem entra numa sala vê a identidade
  anterior. É decisão consciente, com spec de convergência prevista.
- **Arte ASCII é conteúdo hardcoded**, sem CMS. Aceito por ser pequena e decorativa.
- **[NEEDS CLARIFICATION]** A família mono e o desenho exato da arte ASCII ficam para a `sdd-plan` /
  design. A spec fixa só os limites: acromática, ≤ 272px (≤ 26 colunas), ≤ 40 KB.

## Anexo A — numeração legada (âncoras citadas pelo código)

Nenhuma âncora desta spec é citada pelo código ainda. Ao citar `docs/specs/14-identidade-fanzine-crt/spec.md`
em comentário, usar a forma `FR-`/`AC-` — o `anchors.test.ts` valida a existência. Mapa do que esta
spec amenda:

| Spec origem | Requisito | Efeito desta spec |
|---|---|---|
| 01 | FR-045 (papel Display) | Display passa de grotesk geométrico para mono self-hosted (FR-004) |
| 01 | FR-043, FR-044, FR-050, FR-051 | Preservados (FR-001, FR-020, FR-021, FR-022) |
| 13 | FR-018 (identidade sem matiz) | Preservada (FR-001) |
