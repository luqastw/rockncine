# Tarefas — identidade fanzine-CRT (spec 14)

Convenção: `T-NNN` · `[P]` = paralelizável (sem dependência entre si) · cada tarefa aponta ≥1
`FR-`/`AC-` do `spec.md`. Prova = comando ou assert observável. Ordem = dependência real.

## Fundação (bloqueia as superfícies)

- **T-001** Papel Display em `Space_Mono`.
  - Inputs: `app/layout.tsx`, `app/global-error.tsx`, `app/globals.css`, doc local
    `node_modules/next/dist/docs/` (API de `next/font`).
  - Outputs: `Space_Mono({ weight:["700"], subsets:["latin"], variable:"--font-space-mono",
    display:"swap" })` nos dois arquivos de documento; `--font-display: var(--font-space-mono),
    ui-monospace, "SF Mono", …` em `@theme inline`.
  - Prova: `npm run typecheck` e `npx next build` sem erro; `grep -- '--font-display' app/globals.css`.
  - Cobre: FR-004, FR-005.

- **T-002** Tokens de textura e classes de efeito em `app/globals.css`.
  - Inputs: `app/globals.css` (tokens existentes + comentários de âncora).
  - Outputs: tokens `--grain-opacity`, `--grain-size`, `--hairline`, `--ascii-ink`; classe `.grain`
    (SVG `feTurbulence` data-URI, sem animação); classe `.chrome-blur`; regras de `[data-js] .reveal`;
    `@media (prefers-reduced-transparency: reduce)` desligando `.grain` e `.chrome-blur`.
  - Prova: `npx vitest run docs/specs/anchors.test.ts` verde (âncoras preservadas, FR-003);
    AC-003 em browser (grão off + `backdrop-filter: none`).
  - Cobre: FR-002, FR-003, FR-007, FR-008, FR-011, FR-012, FR-013, FR-015.

- **T-003** Marcador de realce progressivo (`js`).
  - Inputs: `app/layout.tsx`, doc local de `<script>`/App Router.
  - Outputs: script inline mínimo marcando `<html data-js>` antes do conteúdo.
  - Prova: `npx next build`; com JS desabilitado, `/` entrega conteúdo visível (AC-001).
  - Cobre: FR-014.

- **T-004** `components/chrome/GrainOverlay.tsx` `[P]`.
  - Outputs: `<div aria-hidden="true" className="grain" />`.
  - Prova: teste T-016 (AC-006).
  - Cobre: FR-007, FR-008.

- **T-005** `components/chrome/ChromeBar.tsx` `[P]`.
  - Outputs: barra fixa com `className="chrome-blur …"` e borda `--hairline`; marca em
    `font-display`.
  - Prova: teste T-017 (AC-008, 0 `backdrop-*` fora de `components/chrome`).
  - Cobre: FR-006, FR-011, FR-012, FR-019.

- **T-006** `components/chrome/ascii.ts` + `AsciiArt.tsx` `[P]`.
  - Outputs: constantes de arte (hero, 404, erro), cada linha ≤ 272px (≤ 26 colunas); `<pre aria-hidden="true">`.
  - Prova: teste T-015 (AC-005) e T-016 (AC-007).
  - Cobre: FR-009, FR-010.

- **T-007** `components/chrome/Reveal.tsx` `[P]`.
  - Outputs: client component; `IntersectionObserver` seta `data-visible`; sem IO, marca visível.
  - Prova: teste T-021 (AC-002).
  - Cobre: FR-013, FR-014, FR-015, FR-016.

- **T-008** `components/chrome/PageShell.tsx`.
  - Inputs: T-004, T-005, T-007.
  - Outputs: invólucro único (largura `sm`/`md`, padding, `GrainOverlay`, `ChromeBar` opcional).
  - Prova: teste T-019 (AC-012).
  - Cobre: FR-017, FR-018, FR-020, FR-021.

## Superfícies (paralelizáveis após T-008)

- **T-009** Hero da landing `[P]`.
  - Inputs: `app/page.tsx`, `PageShell`, `AsciiArt`.
  - Outputs: hero com marca em `font-display`, promessa, CTA primário invertido, `ol` de 3 passos e
    link para `/login` preservados.
  - Prova: teste T-018 (AC-011).
  - Cobre: FR-017, FR-020.

- **T-010** `/login` e `LoginForm` `[P]`.
  - Outputs: página em `PageShell`/`Reveal`; classes de CTA/foco preservadas.
  - Prova: T-020 (AC-013, AC-014).
  - Cobre: FR-018, FR-020, FR-021.

- **T-011** `/register` e `RegisterForm` `[P]` — espelho de T-010. Cobre FR-018, FR-020, FR-021.

- **T-012** `/rooms` `[P]`.
  - Inputs: `app/rooms/page.tsx`.
  - Outputs: cabeçalho da marca movido para `ChromeBar`; seções em `Reveal`; `room-list` preservado.
  - Prova: `app/rooms/page.test.tsx` continua verde; T-019 (AC-012).
  - Cobre: FR-006, FR-018, FR-020, FR-021.

- **T-013** `not-found`, `error`, `global-error` `[P]`.
  - Outputs: mesma linguagem (fio + `AsciiArt` decorativa + mono); `global-error` com `Space_Mono`.
  - Prova: T-020 (AC-016).
  - Cobre: FR-019, FR-018.

## Testes (paralelizáveis)

- **T-014** Teste de tokens — `components/chrome/identity.test.ts` (`@vitest-environment node`).
  - Lê `app/globals.css`, extrai hex/rgb em variável, afirma R=G=B (AC-009); afirma que os tokens da
    spec 01/13 continuam declarados (AC-010).
  - Cobre: AC-009, AC-010 · FR-001, FR-002.

- **T-015** Teste de largura da arte — lê `ascii.ts`, afirma `max(colunas) × 0,62em × 16px ≤ 272px`.
  Cobre AC-005 · FR-010.

- **T-016** Teste de a11y de grão e ASCII — `GrainOverlay` tem `aria-hidden`/`pointer-events:none`/
  sem animação (AC-006); `AsciiArt` fora das consultas por papel e marca no `h1` (AC-007).
  Cobre AC-006, AC-007 · FR-007, FR-009.

- **T-017** Teste de varredura de blur — `components/room/**` e `app/rooms/**` com 0 ocorrências de
  `backdrop-filter`/`backdrop-blur`. Cobre AC-008 · FR-011.

- **T-018** Teste de render da landing — `app/page.tsx` com `getServerSession` mockado para `null`;
  `h1` "rockncine", link `/register`, link `/login`, `ol` com 3 itens. Cobre AC-011 · FR-017.

- **T-019** Teste de invólucro e alvos — todas as superfícies em escopo importam `PageShell`
  (AC-012); todo `<button>` e link de navegação tem `min-h-11`, links inline isentos (AC-014).
  Cobre AC-012, AC-014 · FR-018, FR-021.

- **T-020** Teste de hierarquia e estados de erro — CTA primário usa `--invert-bg`/`--invert-fg`,
  secundário contorno, foco `--outline-strong` (AC-013); `not-found`/`error` exibem fio + ASCII
  decorativa (AC-016). Cobre AC-013, AC-016 · FR-019, FR-020.

- **T-021** Teste de realce progressivo — sem `IntersectionObserver`, nenhuma seção nasce oculta
  (AC-002); HTML de `/` contém o conteúdo sem depender do wrapper (AC-001).
  Cobre AC-001, AC-002 · FR-013, FR-014.

## Fechamento

- **T-022** Gate e auditorias manuais.
  - `npm run gate` verde (typecheck + eslint + vitest + build) e `anchors.test.ts` verde.
  - Auditoria manual registrada em `research.md`: contraste ≥ 4,5:1 (AC-015), reduced-motion em
    browser com duração ≤ 0.01ms (AC-004), grão/blur desligados em `prefers-reduced-transparency`
    (AC-003), 0 rolagem horizontal em 320px.
  - Diff limpo em `app/rooms/[code]/**` e `components/room/**` (AC-017).
  - Cobre: NFRs (fonte ≤ 40 KB, blur ≤ 12px, movimento, a11y) e AC-003, AC-004, AC-015, AC-017.

## Cobertura FR → tarefa (analyze)

Todos os FR-001 a FR-022 e AC-001 a AC-017 têm ≥ 1 tarefa dona (T-001 a T-022). Nenhuma tarefa sem
requisito. Nenhum requisito órfão.
