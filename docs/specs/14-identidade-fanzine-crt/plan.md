# Plano técnico — identidade fanzine-CRT (spec 14)

**Spec:** `spec.md` · **Tarefas:** `tasks.md` · **Diagnóstico:** `research.md`
**Stack real:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Vitest 4 + Testing Library (jsdom).

---

## 1. Constitution & Triforce check (gate)

O projeto **não é o stack do Triforce** (Laravel multi-tenant, módulos `Agency`/`Customer`,
`companyParameters`, Policies, seeders RBAC). Os vértices são mapeados para o equivalente real; o
que não existe aqui é registrado como N/A, com justificativa — não inventado.

| Vértice | Regra canônica | Status | Justificativa |
|---|---|---|---|
| Poder (Backend) | Model lean, Service + transação, Policy, State Machine | ✅ N/A | Nenhuma mudança em `prisma/`, `app/api/**` ou Liveblocks. O redesign é apresentação pura; não há entidade, rota ou contrato a tocar. |
| Coragem (Frontend) | Módulo estrito `Agency`/`Customer`, preservar `companyParameters`, state lifting | ✅ adaptado | App single-tenant: não há módulo de escopo nem parâmetro corporativo. O equivalente é o **escopo de superfícies declarado** (spec 2.1): chrome em `components/chrome/**`, sala intacta (AC-017). |
| Sabedoria (Testes) | Reuso de base, matriz RBAC, 2xx em `waitForResponse` | ✅ adaptado | Sem RBAC/E2E. As provas são `npm run gate` + testes de varredura de fonte no padrão de `anchors.test.ts` + render RTL por papel. |
| Constitution (`AGENTS.md`) | Ler `node_modules/next/dist/docs/` antes de escrever código Next | ✅ ação obrigatória | T-001 e T-003 leem a doc local de `next/font` e de `<script>`/error antes de editar `layout.tsx` e `global-error.tsx`. |

Nenhuma violação bloqueante. Constitution respeitada; nenhum pacote novo será adicionado (ver §3).

## 2. Pontos de integração (Fase 1 — frescor)

Verificado hoje: `app/globals.css` (tokens + animações + reduced-motion), `app/layout.tsx` (Inter
via `next/font`), `app/global-error.tsx` (client, substitui o documento e redeclara a fonte),
`app/{page,login,register}` e `app/rooms/page.tsx` (cada um com seu `main`), `app/{not-found,error}`,
`vitest.config.mts` (`include: **/*.test.{ts,tsx}`, jsdom), `vitest.setup.ts` (stub de `matchMedia`),
`docs/specs/anchors.test.ts` (varre `app|components|hooks|lib|prisma`, inclui `.css`).
`app/rooms/new` é `route.ts`, sem UI. Todos os arquivos citados existem como o spec descreve.

## 3. Decisões (Fase 3)

### D-001 — Papel Display em `Space Mono`

- **Decisão:** `Space_Mono` (peso 700) via `next/font/google`, `subsets:["latin"]`,
  `display:"swap"`, `variable:"--font-space-mono"`; `--font-display` em `@theme inline` aponta para
  ela, com fallback mono do sistema.
- **Por que:** serif-less com personalidade retrô/zine, ASCII-friendly, um único peso carrega ≤ 40 KB.
  `next/font` self-hospeda no build — não é dependência npm nem requisição a terceiro em runtime.
- **Alternativas rejeitadas:** `IBM Plex Mono` (neutra demais, sem grão de zine); `JetBrains Mono`
  (cara de editor de código, não de cartaz); arquivo próprio em `public/` (mais um asset + licença a
  resolver, sem ganho sobre `next/font`).

### D-002 — Grão por SVG `feTurbulence` como data-URI

- **Decisão:** uma classe `.grain` (`position:fixed; inset:0; pointer-events:none`) com
  `background-image: url("data:image/svg+xml,…feTurbulence…")`, `opacity` e `background-size` por
  token. Sem `animation`/`transition` (FR-007).
- **Por que:** achromático por construção, escalável, zero asset binário, sem requisição extra.
- **Alternativas rejeitadas:** PNG de ruído (asset binário, precisa versionar imagem); gradiente
  `repeating-*` (padrão geométrico perceptível, não grão); filtro SVG inline no DOM por página
  (mais nós, mesmo efeito).

### D-003 — Realce progressivo sem flash (marcador `js`)

- **Decisão:** script inline mínimo em `layout.tsx` marca `<html data-js>`; o CSS esconde
  `[data-js] .reveal` e revela com `[data-visible]`. O `Reveal` (client) só liga o
  `IntersectionObserver` e seta `data-visible`; se o IO não existir, seta imediatamente.
- **Por que:** sem JS, `[data-js]` não existe → `.reveal` é visível e o conteúdo está no HTML
  (AC-001); com IO ausente, o efeito marca visível (AC-002). É o único caminho que satisfaz os dois
  ACs sem depender de evento de hidratação.
- **Alternativas rejeitadas:** `useState(false)` + efeito de montagem (SSR sai oculto → falha
  AC-001); `<noscript>` com override (frágil e não cobre "JS presente, IO ausente"); `@starting-style`
  (suporte irregular no alvo).

### D-004 — Grão e chrome no invólucro de página, não no layout raiz

- **Decisão:** `PageShell` (em `components/chrome/`) renderiza grão + chrome e é usado pelas telas em
  escopo; o `layout.tsx` só ganha a variável de fonte e o marcador `js`.
- **Por que:** o layout raiz é ancestral da sala; grão ali vazaria para o player e quebraria AC-017.
  (Divergência da redação original da spec 2.1 — corrigida no `spec.md`, que é o dono.)
- **Alternativas rejeitadas:** grão no `layout.tsx` com exceção por rota (condicional em server
  layout para uma rota que nem deve mudar é dívida gratuita).

### D-005 — `backdrop-filter` isolado em `components/chrome/**`

- **Decisão:** a classe `.chrome-blur` (blur ≤ 12px + fundo translúcido + `--hairline`) vive só em
  `globals.css` e só é usada por `ChromeBar`; `app/rooms/**` e `components/room/**` não contêm o
  literal `backdrop-blur`/`backdrop-filter` (AC-008).
- **Por que:** o produto já teve lag por efeito sobre o player (specs 02/08); o chrome é a única
  superfície onde desfoque é seguro e não compete com o vídeo.

**Dependências novas:** nenhuma. `next/font/google` já é usado (Inter). Nenhum pacote será instalado
sem aprovação.

## 4. Arquitetura e arquivos

**Criar (`components/chrome/`)** — todos server components, exceto `Reveal`:

| Arquivo | Papel |
|---|---|
| `PageShell.tsx` | Invólucro de página: largura (`sm`/`md`), padding, `GrainOverlay`, `ChromeBar` opcional |
| `GrainOverlay.tsx` | `<div aria-hidden="true" class="grain">` |
| `ChromeBar.tsx` | Barra fixa com `.chrome-blur` + `--hairline` + marca em `font-display` |
| `AsciiArt.tsx` | `<pre aria-hidden="true">` renderizando uma constante de `ascii.ts` |
| `ascii.ts` | Constantes de arte (hero, 404, erro), ≤ 272px por linha (≤ 26 colunas) |
| `Reveal.tsx` | Client: IO → `data-visible`; fallback visível |

**Alterar:**

- `app/globals.css` — tokens (`--font-display`, `--grain-opacity`, `--grain-size`, `--hairline`,
  `--ascii-ink`), `.grain`, `.chrome-blur`, regras de `.reveal`, `prefers-reduced-transparency`,
  e o papel Display sobre `[data-js] .reveal`. **Preservar os comentários de âncora** (FR-003).
- `app/layout.tsx` — `Space_Mono` + marcador `js`.
- `app/global-error.tsx` — `Space_Mono` na sua própria `<html>`.
- `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, `app/rooms/page.tsx` —
  passam a usar `PageShell`/`ChromeBar`/`Reveal`/`AsciiArt`.
- `app/not-found.tsx`, `app/error.tsx` — mesma linguagem.

**Inalterar (AC-017):** `app/rooms/[code]/**`, `components/room/**`, `prisma/`, `app/api/**`.

**Artefatos do SDD omitidos, com motivo:** `data-model.md` e `contracts/` — não há entidade, campo,
relação, migração, rota ou payload nesta feature (ver §1, vértice do Poder).

## 6. Analyze (spec × plan × tasks × Triforce)

| Checagem | Resultado |
|---|---|
| Todo `FR-001` a `FR-022` tem ≥ 1 tarefa dona | ✅ (FR-006 era órfão no primeiro rascunho; alocado a T-005/T-012) |
| Todo `AC-001` a `AC-017` tem prova nomeada | ✅ |
| Toda tarefa aponta para requisito real | ✅ (nenhuma tarefa solta) |
| Suposição fraca / NFR sem threshold | ✅ (fonte ≤ 40 KB, blur ≤ 12px, movimento ≤ 400ms, contraste ≥ 4,5:1) |
| Contrato sem erro mapeado | ✅ N/A (sem contrato de API) |
| Pré-auditoria Triforce | ✅ N/A (sem `RefreshDatabase`, sem Service/orquestração, sem módulo de frontend a violar) |
| Âncoras de spec preservadas em `globals.css` | ✅ T-002 roda `anchors.test.ts` |

**Nuance registrada.** FR-011 proíbe blur em `app/rooms/**`. T-012 altera `app/rooms/page.tsx` (a
lista) para usar `ChromeBar`, cuja classe `.chrome-blur` mora em `components/chrome/**` — o literal
nunca aparece em `app/rooms/**`, então AC-008 continua verde. A sala (`app/rooms/[code]/`) permanece
intocada.

**Duas decisões de testabilidade.** (1) AC-014 isenta links inline de texto (WCAG 2.5.5 tem essa
exceção; o app já usa esse padrão no "cadastrar" de `/login`). (2) AC-003, AC-004 e AC-015 dependem
de media query computada / contraste medido, que o jsdom não resolve — são auditorias manuais
bloqueantes, registradas em `research.md` por T-022.

## 7. Alternativas de abordagem rejeitadas (resumo)


- **Redesenhar a sala nesta rodada:** descartada — mistura risco de contraste sobre vídeo e histórico
  de lag com a troca de identidade; a spec fixa a convergência como spec futura.
- **Textura em `background-image` no `<body>` do layout:** descartada por D-004.
- **Componente cliente para o shell inteiro:** descartada — empurraria marca e ASCII para o bundle do
  cliente sem necessidade; só `Reveal` precisa de cliente.
