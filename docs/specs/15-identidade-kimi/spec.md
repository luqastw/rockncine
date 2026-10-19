# Spec: identidade Kimi Platform — superfícies, tipografia e composição

**Status:** implementado
**Pesquisa:** `research.md`
**Tarefas:** `tasks.md`
**Substitui:** `docs/specs/14-identidade-fanzine-crt/spec.md` (a camada de grão e ASCII sai de cena)

---

## 1. Problema / motivação

O app é monocromático e dark-first (spec 01, seção 8), mas a identidade fanzine-CRT da spec 14
deixou a superfície com textura de impresso e arte ASCII. O pedido é uma linguagem mais silenciosa e
organizada, alinhada à Kimi Platform: canvas profundo, camadas neutras, hierarquia por opacidade,
separadores de 1px, raios de 8–16px, blur curto no chrome, Geist/Geist Mono e composição arejada.

O redesign mantém a regra herdada de que **estado nunca é sinalizado por matiz** (FR-044 da spec 01)
e a identidade sem cor da spec 13 (FR-018). Nenhum acento cromático entra: a paleta continua
acromática por decisão de produto.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Substituir os tokens da identidade anterior por uma escala neutra derivada da Kimi Platform.
2. Trocar a tipografia para Geist (corpo) e Geist Mono (display, labels, código).
3. Unificar superfícies, raios, sombras e espaçamento em primitivos compartilhados.
4. Aplicar a linguagem ao app inteiro, incluindo a sala (que a spec 14 deixou fora de escopo).
5. Manter o piso de acessibilidade: contraste, foco visível e alvo de 44px.

**Não-objetivos**

- Tema claro, seletor de tema ou cor de acento.
- Copiar assets, logotipo, textos ou a fonte MiSans da Kimi.
- Nova dependência npm para fontes ou componentes.
- Alterar lógica de negócio, sync, Liveblocks, LiveKit ou schema.

## 3. Histórias de usuário

- **US-1**: Como visitante, quero uma página pública com hierarquia clara e sem ruído visual.
- **US-2**: Como participante, quero que a sala, o chat e o player pareçam o mesmo produto.
- **US-3**: Como quem usa teclado ou leitor de tela, quero foco visível e alvos de 44px.
- **US-4**: Como quem prefere menos transparência/movimento, quero que glow, blur e animações
  respeitem minhas preferências.

## 4. Requisitos funcionais (EARS)

### Cor e tokens

- **FR-001** A paleta DEVE ser 100% acromática: todo literal de cor em `app/globals.css` tem
  `R=G=B`; nenhum `hsl()` com saturação, nome cromático ou função de croma.
- **FR-002** O sistema DEVE preservar os tokens `bg-void`, `bg-surface`, `line`, `ink`, `ink-muted`,
  `invert-bg`, `invert-fg`, `outline-strong`, `id-1..4`, `scrim` e `focus-offset`, e adicionar
  `bg-elevated`, `fill-1..3` e `hairline`.
- **FR-003** O sistema DEVE usar Geist como sans e Geist Mono como mono/display, via
  `next/font/google`, sem webfont adicional.
- **FR-004** O sistema DEVE usar a escala tipográfica 18/26, 16/24, 15/22, 14/20, 12/18 e 10/14, e
  raios de 8, 10, 12, 16 e 20px.

### Chrome e superfícies

- **FR-005** A barra de chrome DEVE usar fundo `rgb(18 18 18 / 0.72)`, `backdrop-filter: blur(6px)`
  e fio `--hairline` quando houver scroll. Nenhum outro arquivo fora de `components/chrome/**` e
  `components/room/player/PlayerControls.tsx` usa `backdrop-*`.
- **FR-006** O glow ambiente DEVE ser uma camada fixa, `aria-hidden`, `pointer-events: none`,
  estática e acromática; `prefers-reduced-transparency: reduce` a desliga junto com o blur.
- **FR-007** A marca DEVE ser um wordmark real em Geist Mono com gradiente prateado
  (`#b3b3b3 → #ffffff → #8f8f8f`). A arte ASCII e o grão da spec 14 não existem mais.
- **FR-008** Os controles DEVEM compartilhar primitivos: primário invertido, secundário com
  `border-[var(--ink-muted)]`, `min-h-11` em todo alvo de toque.

### Sala e movimento

- **FR-009** A sala DEVE usar `bg-surface` em painéis, `bg-elevated` na bolha própria do chat,
  `rounded-xl` na moldura do vídeo e `rounded-2xl` nos diálogos. O player mantém controles de 44px
  em px para não quebrar com texto a 200%.
- **FR-010** O movimento DEVE ser curto (≤ 380ms), apenas `opacity`/`transform`, e zerado por
  `prefers-reduced-motion`. Nenhuma animação infinita.

## 5. Critérios de aceite

- **AC-001** [FR-001] Dado `app/globals.css` sem comentários, quando o guard varre hex/rgb, então
  todos os literais têm `R=G=B` e há ≥ 10 cores coletadas.
- **AC-002** [FR-002] Dado o CSS, então os 14 tokens legados e os novos `bg-elevated`, `fill-1..3`
  e `hairline` estão declarados.
- **AC-003** [FR-003] Dado `app/layout.tsx` e `app/global-error.tsx`, então ambos declaram as
  variáveis `--font-geist` e `--font-geist-mono`, e nenhum importa `Inter`/`Space_Mono`.
- **AC-004** [FR-004] Dado o CSS, então `--radius-md` = 10px, `--radius-xl` = 16px e as classes
  `text-title/heading/body/body-sm/caption/micro` existem em `@theme`.
- **AC-005** [FR-005] Dado `styles.test.ts`, quando lê `.chrome-blur`, então o blur é ≤ 12px, o
  fundo é `rgb(18 18 18 / 0.72)` e `[data-scrolled="true"]` aplica `--hairline`.
- **AC-006** [FR-006] Dado `styles.test.ts`, quando lê `.ambient`, então há `position: fixed`,
  `pointer-events: none`, nenhuma `animation`/`transition`; em reduced-transparency há
  `display: none` e `backdrop-filter: none`.
- **AC-007** [FR-007] Dado `Wordmark`, então o texto “rockncine” está fora de `aria-hidden` e o nó
  decorativo tem `aria-hidden="true"`.
- **AC-008** [FR-008] Dado `surfaces.test.tsx`, então todo `<button>` e link de navegação das 5
  superfícies tem `min-h-11`, o primário contém `bg-[var(--invert-bg)]`/`text-[var(--invert-fg)]` e
  o secundário contém `border-[var(--ink-muted)]`.
- **AC-009** [FR-009] Dado `Chat.test.tsx`, então a mensagem própria contém
  `bg-[var(--bg-elevated)]` e não contém `invert-*`.
- **AC-010** [FR-010] Dado o CSS, então toda regra que toca `.reveal` continua ancorada em
  `[data-js]`/`[data-reveal]` e o bloco de reduced-motion zera animações/transições.
- **AC-011** O gate `npm run gate` termina verde (typegen, tsc, eslint, vitest, build).
- **AC-012** Auditoria manual: `--ink` e `--ink-muted` ≥ 4,5:1 sobre `#121212` e `#1f1f1f`; sem
  rolagem horizontal em 320px; texto a 200% não recorta composer nem barra do player.

## 6. NFRs

- Contraste de texto ≥ 4,5:1; contorno de componente interativo ≥ 3:1.
- Alvo de toque ≥ 44px em links e botões de página; controles do player em px por causa do overlay.
- Blur ≤ 12px e no máximo 2 elementos por página.
- Nenhuma animação infinita; revelação ≤ 400ms.
- 0 rolagem horizontal em 320px; gate verde.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Geist indisponível no build | `next/font/google` já era usado; a pilha mantém a fonte do sistema como fallback. |
| Remoção de grão/ASCII quebra a spec 14 | A spec 15 substitui explicitamente a 14; README marca a mudança. |
| Blur no player viola o guard de escopo | Allowlist de um único arquivo, documentada em `scope.test.ts`. |
| Primitivos mudam classes que os testes procuram | Contrato de classes fixado e coberto por AC-008. |
| `--ink-muted` translúcido reduz contraste | Valor calibrado em 56% de branco (~6:1 sobre `#1f1f1f`). |
