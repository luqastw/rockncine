# Research: identidade fanzine-CRT

Registro do diagnóstico que fundamenta `spec.md`. Não é ata da conversa: é o estado do código, as
referências e o que foi descartado, com o porquê.

## 1. Referências analisadas

Ambas foram lidas como **vocabulário estético**, não como pixel a copiar. O redesign não reproduz
nenhuma das duas; extrai o gesto e o traduz nos limites desta casa (monocromático, nunca por matiz).

| Referência | O que se aproveita | O que não se copia |
|---|---|---|
| **Hermes Agent / Nous Research** (`hermes-agent.nousresearch.com`) | Vocabulário de terminal: mono no comando de install (`curl … \| bash`), banner ASCII, tom "máquina crua", CRT. Instalação como gesto de produto. | Não é um site; é uma landing de CLI. O banner ASCII colorido do Hermes não entra — aqui só P&B. |
| **Moonshot AI** (`moonshot.ai`) | Amplo espaço em branco, hierarquia tipográfica calma, movimento sutil de entrada, "doodles" como textura sazonal. | Paleta e ilustração próprias; nada de cor. O tom corporativo/limpo demais é o oposto do punk pedido. |

Síntese do pedido do usuário: **fanzine xerocado** (grão, fio, mono, preto no branco) encontra
**terminal ASCII** (crueza do Hermes), temperado pela calma espacial do Moonshot. Tudo dentro da
gramática monocromática já vigente.

## 2. Estado atual do design (inventário)

**Tokens** (`app/globals.css`): paleta dark-first acromática — `--gray-950 #0a0a0a`,
`--gray-900 #141414`, `--gray-700 #2a2a2a`, `--gray-500 #828282`, `--gray-100 #f2f2f2`, preto e
branco puros; semânticos `--bg-void`, `--bg-surface`, `--line`, `--ink`, `--ink-muted`,
`--invert-bg`/`--invert-fg`, `--outline-strong`, `--focus-offset`, `--scrim`, `--id-1..4`.
Nenhuma matiz. Regra dura: estado por contraste/inversão/peso (spec 01, FR-044).

**Tipografia** (`app/layout.tsx`, `globals.css`): `--font-sans` = sistema (SF Pro, com Inter como
fallback via `next/font`); `--font-mono` = mono do sistema. Papel Display hoje é `font-semibold
tracking-tight` sobre a sans (spec 01, FR-045) — é o ponto que o redesign muda.

**Movimento existente**: `rise-in` (260ms), `pop-in` (200ms), `fade-in` (160ms); cascata `.room-list`
com `animation-delay` até 120ms; `sync-flash` (350ms); `animate-sync-pulse` (box-shadow estático).
Tudo zerado por `prefers-reduced-motion` e pela classe `.reduce-motion` (modo economy). Transição
base de `color`/`background`/`border`/`opacity`/`transform` em 180ms `@layer base`.

**Textura**: nenhuma. Superfícies chapadas. Não há grão, fio fino, dither nem halftone.

**Citações de spec no CSS**: `app/globals.css` é o arquivo com mais citações do repo (guarda do
`anchors.test.ts`, spec 11). Editorial nele exige preservar os comentários de âncora.

## 3. Superfícies e arquivos

| Superfície | Arquivo(s) | Invólucro atual |
|---|---|---|
| `/` | `app/page.tsx` | `main … max-w-md` próprio |
| `/login` | `app/login/page.tsx`, `components/LoginForm.tsx` | `main … max-w-sm animate-rise` |
| `/register` | `app/register/page.tsx`, `components/RegisterForm.tsx` | `main … max-w-sm animate-rise` |
| `/rooms` | `app/rooms/page.tsx`, `JoinRoomForm`, `CreateRoomForm`, `DeleteRoomButton`, `SignOutButton` | `main … max-w-md` |
| 404 | `app/not-found.tsx` | `main … max-w-sm` |
| erro de segmento | `app/error.tsx` | `main … max-w-sm` |
| erro global | `app/global-error.tsx` | próprio |
| shell | `app/layout.tsx` | `body min-h-full flex flex-col` |

`app/rooms/new` é `route.ts` (POST → redirect 303), sem UI. `app/rooms/[code]/**` e
`components/room/**` ficam **fora** desta rodada.

Padrões repetidos a unificar: `min-h-11` em todo alvo de toque; CTA primário = `bg-[var(--invert-bg)]
text-[var(--invert-fg)]`; secundário = `border-[var(--ink-muted)]` → `hover:border-[var(--ink)]`;
foco = `ring-2 ring-[var(--outline-strong)] ring-offset-2 ring-offset-[var(--focus-offset)]`;
rótulo de seção = `font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]`.

## 4. Restrições herdadas (não redecididas)

- Estado nunca por matiz — spec 01 FR-044; identidade de participante idem — spec 13 FR-018.
- Foco visível em todo interativo — spec 01 FR-050.
- `prefers-reduced-motion` desliga transição — spec 01 FR-051; modo economy zera animação.
- Alvo ≥ 44px — spec 01 NFR-002; contraste de corpo ≥ 4,5:1 — spec 01 NFR-001.
- Cabeçalho de sala e `22rem` do cálculo de altura do vídeo são sensíveis a reflow — motivo a mais
  para manter textura fora da sala.

## 5. Descartado (com motivo)

| Item | Motivo |
|---|---|
| Variante clara / toggle de tema | Exige segunda paleta inteira, revalidar contraste de todo estado e um controlador de tema. Fora do pedido ("preto e branco", dark-first). |
| Parallax / scroll pinado | Anima propriedade de layout e briga com a regra de movimento; custo alto em aparelho fraco. |
| Cursor customizado, som, vídeo de fundo | Ruído de marca; sem relação com o minimalismo preservado. |
| ASCII colorido (estilo banner do Hermes) | Viola a regra de matiz desta casa. |
| Segunda webfont (display + mono distintas) | Dobra bytes e licenças; a mono cobre Display e Utilitária. |
| Grão/blur dentro da sala | Histórico de lag por efeito no player (specs 02/08); a sala fica fora do escopo. |
| ASCII como conteúdo (hero com informação) | Precisa de fallback textual e entra na árvore de acessibilidade; a spec trata ASCII como decoração. |

## 6. Pendências para a `sdd-plan`

- Escolha da família mono (licença web clara, subset latin, ≤ 40 KB).
- Desenho da arte ASCII (hero, 404 e erro), ≤ 26 colunas (≤ 272px em 320px).
- Componentização do invólucro de página e do wrapper de revelação (server vs client).
- Testes determinísticos para AC-005 (largura da arte), AC-008 (blur só no chrome), AC-009 (tokens
  acromáticos) e AC-014 (alvo ≥ 44px) — todos por varredura de fonte/DOM, no padrão de
  `anchors.test.ts`.

## 7. Auditorias (T-022)

Registro das medições que o `spec.md` pede. O que depende de browser real está marcado como
**pendente** — não foi medido, e não se declara medido.

### AC-015 — contraste (aritmética WCAG 2.1, calculado)

| Par | Fórmula | Razão | Piso |
|---|---|---|---|
| `--ink` #f2f2f2 sobre `--bg-void` #0a0a0a | (0,8879+0,05)/(0,00304+0,05) | **17,69:1** | ≥ 4,5:1 ✅ |
| `--ink` #f2f2f2 sobre `--bg-surface` #141414 | (0,8879+0,05)/(0,00699+0,05) | **16,46:1** | ≥ 4,5:1 ✅ |
| `--ink-muted` #828282 sobre `--bg-void` | (0,2232+0,05)/(0,00304+0,05) | **5,15:1** | ≥ 4,5:1 ✅ |
| `--ink-muted` #828282 sobre `--bg-surface` | (0,2232+0,05)/(0,00699+0,05) | **4,79:1** | ≥ 4,5:1 ✅ |
| `--ascii-ink` #4d4d4d sobre `--bg-void` | (0,0742+0,05)/(0,00304+0,05) | 2,34:1 | isento (FR-022) |

A única razão abaixo do piso é a da arte decorativa, que FR-022 isenta nominalmente (é `aria-hidden`,
textura de fundo). Decisão registrada: se a arte deixar de ser decorativa, `--ascii-ink` sobe para
≥ 4,5:1.

### AC-005 — largura da arte (aritmética, calculado)

Coluna útil em 320px = `320 − 2×24` (`px-6` do PageShell) = **272px**. Avanço do Space Mono 700
medido no woff2 embarcado: `advanceWidth 600 / unitsPerEm 1000` = 0,6em; o teste usa **0,62em** (pior
caso, cobre a mono de fallback). A 16px:

| Arte | Máx. colunas | Largura | Cabe em 272px |
|---|---|---|---|
| `HERO_ART` | 23 | 228,2px | ✅ |
| `NOT_FOUND_ART` | 18 | 178,6px | ✅ |
| `ERROR_ART` | 18 | 178,6px | ✅ |

O rascunho orçava 40 colunas (~384px, não caberia) e o AC media colunas — passava por vacuidade. O
contrato foi corrigido (FR-010/AC-005) e o teste passou a medir px. Guard adicional no CSS:
`.ascii { overflow-x: clip }`.

### AC-003 / AC-004 — media queries (estrutura provada; computado pendente)

- `styles.test.ts` prova que o bloco `@media (prefers-reduced-transparency: reduce)` existe e desliga
  `.grain` (`display: none`) e `.chrome-blur` (`backdrop-filter: none`).
- A regra global de `prefers-reduced-motion` (`animation-duration/transition-duration: 0.01ms
  !important`) e o `.reduce-motion` do modo economy cobrem `[data-js] .reveal` — a transição nova vive
  em `transition`, que a regra zera.
- **[pendente]** O valor **computado** em browser (o `backdrop-filter: none` efetivo sob a media query
  real, e a duração computada ≤ 0,01ms) exige navegador com a preferência ligada. Não há browser nesta
  sessão; é a verificação manual de release de AC-003/AC-004.

### AC-017 — escopo

`git status --short` e `git diff --name-only HEAD` não listam nenhum arquivo de `app/rooms/[code]/**`,
`components/room/**`, `prisma/` ou `app/api/**`. ✅

### Revisão de código (diff-reviewer) — correções aplicadas

O review inicial reprovou por dois bloqueadores, ambos corrigidos antes do gate final: (1) a arte
estourava a coluna em 320px e o AC-005 medía a grandeza errada; (2) AC-003/AC-004/AC-015 não estavam
registrados. Também corrigidos: rede de segurança de FR-014 (falha de chunk deixava o site invisível),
`suppressHydrationWarning` no `<html>`, scan de cor ampliado para literais dentro de blocos de regra,
arte de erro separada da de 404, largura do `ChromeBar` alinhada ao `PageShell`, `.animate-rise` morto
removido, e asserts vacuosos trocados.

