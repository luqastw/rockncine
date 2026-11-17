# DESIGN — rockncine

Sistema visual vigente. Fonte de verdade dos tokens: `app/globals.css`. Os testes em
`components/chrome/*.test.*` afirmam este documento.

## 1. Princípio
Cinema noturno em floresta: fundo escuro esverdeado nunca chapado, ouro como único acento de
destaque, contraste tipográfico alto e superfícies chanfradas com cantos ornamentados. Referência
por gramática (chanfro, filete dourado, losango, folha), nunca por objeto copiado.

## 2. Cor
Paleta fechada, declarada em `:root`. Todo literal de cor em `globals.css` pertence a ela.

| Token | Valor | Uso |
|---|---|---|
| `--bg-void` | `#0f1a14` | fundo base, `themeColor` |
| `--bg-surface` / `--bg-elevated` | `#16241c` / `#1d2e24` | superfícies, hover de cartão |
| `--line` / `--line-strong` | `#2a3a2c` / `#6b7f68` | divisores neutros, borda de campo |
| `--ink` / `--ink-muted` | `#e8e2cc` / `#a8ad98` | texto (contraste >= 4,5:1 sobre o fundo) |
| `--leaf` / `--leaf-ink` | `#5f9e4f` / `#7bb86a` | estado ativo, presença |
| `--gold-hi` / `--gold` / `--gold-lo` | `#f0cf7a` / `#d9a441` / `#a87a2a` | acento, títulos, CTA |
| `--fairy` | `#bfe6ff` | foco, sinal de sync |
| `--heart` | `#e07a6e` | erro e ação destrutiva |
| `--parchment*` | `#e8dfc2`, `#2a2417`, `#c9bd96` | acento pontual; a sala e `/rooms` não usam |

Derivados: `--gold-grad` (gradiente vertical hi, gold, lo, aplicado em texto por `.text-gold` com
`background-clip: text` e em botão por `.btn-gold`) e `--gold-edge` (borda dourada apagada para
molduras e filetes).

## 3. Tipografia
- Display: Fraunces via `next/font/google` com eixos `SOFT`, `WONK`, `opsz`; `font-variation-settings`
  com `opsz` 144 e `SOFT` 100 em `h1`, `h2`, `h3` e `.font-display`.
- Corpo: Geologica (`--font-geologica`). Mono: Geist Mono para códigos de sala.
- Escala (utilitários Tailwind gerados dos tokens `--text-*`):

| Token | Faixa | Uso |
|---|---|---|
| `text-display` | 48 a 96px (clamp) | h1 de landing e 404 |
| `text-h2` | 32 a 56px (clamp) | título de página e de seção |
| `text-card` | 24 a 32px (clamp) | título de cartão |
| `text-title` / `text-heading` | 28px / 20px | título de painel e de sala |
| `text-body` / `text-caption` | 15px / 13px | texto corrido, legenda |

- Títulos de página e de seção usam gradiente dourado. Capitalização de frase em todo texto
  visível; códigos de sala ficam em caixa alta.

## 4. Cantos
- Contêineres e CTA dourado: chanfro de 45 graus. `--clip` 20px (padrão), `--clip-lg` 32px (`.frame-lg`,
  superfícies grandes), `--clip-btn` 12px (`.frame-btn`).
- `.frame`: borda dourada de 1px feita por camada interna chanfrada; ornamentos em diagonal nos
  cantos superior esquerdo e inferior direito (`.frame::after`).
- Botões secundários, campos e vídeo: raio de 4px (`--radius-*` todos 0,25rem). Círculo só em botão
  de ícone (`.btn-round`, controles do player).

## 5. Fundo e superfícies
- `body::before` fixo: vinheta radial dourada no topo, vinheta escura nas bordas e treliça de losangos
  com folha (`--lattice`, traço a no máximo 5% de opacidade).
- Seções de largura total separadas por filete dourado de borda a borda (`.divider-gold`, componente
  `Divider`); faixas texturizadas com `.band`.
- Névoa (`Fog`) no pé das páginas públicas e de estado. Player, chat e vídeo ficam sem textura.
- Larguras: `PageShell` com `sm` (estados, 36rem), `md` (64rem), `lg` (80rem) e `full` (sem coluna,
  seções próprias).

## 6. Navegação
- Área logada (`/rooms`, `/profile`): trilho fixo à esquerda de 72px em `lg+` (marca e botão
  "Menu" vertical); em telas menores, barra superior com "Menu" à direita.
- "Menu" abre overlay de tela cheia (`SiteNav`): Salas, Perfil e Sair em Fraunces grande, página atual
  marcada com ▷ dourado e `aria-current`. `aria-expanded` e `aria-controls` no gatilho, foco preso,
  Escape fecha e devolve o foco, rolagem do documento travada.
- Landing e autenticação: barra superior leve (`ChromeBar`). Sala: cabeçalho próprio de uma linha com
  botão de voltar; em telas pequenas as ferramentas ficam num menu de overflow.

## 7. Foco e controles
- Foco por mira (`.reticle`, cantos em `--fairy`) e anel interno em campos (`.field-ring`).
- Alvos de toque >= 44px (`min-h-11`). Foco visível nunca removido.
- Ícones: uma família em `components/room/player/icons.tsx`, viewBox 32x32, glifos sólidos em
  `currentColor`.

## 8. Movimento
Tokens em `:root`; tudo zera em `prefers-reduced-motion` e `.reduce-motion` (durações e atrasos).

| Token | Valor | Uso |
|---|---|---|
| `--dur-reveal` / `--ease-reveal` | 800ms / `cubic-bezier(0, 0, 0.58, 1)` | entrada em vista (opacidade e translação) |
| `--stagger-reveal` | 200ms | atraso entre irmãos (`Reveal index`) |
| `--dur-menu` / `--ease-menu` | 500ms / `cubic-bezier(0.73, 0.42, 0.52, 0.703)` | fundo do overlay |
| `--dur-menu-item` / `--stagger-menu` | 300ms / 70ms | emblema e itens do menu |
| `--motion-dur` / `--motion-ease` | 200ms / `cubic-bezier(0.16, 1, 0.3, 1)` | hover, foco, entradas curtas |

Sem animação infinita. Só `opacity`, `transform` e `filter`/`backdrop-filter` no overlay.

## 9. Proibições
Palavras `Zelda`, `Navi`, `Triforce`, `Hyrule`, `Kokiri`, `Saria`, `Korok`, `Nintendo` e `Ocarina` em
texto visível ou `aria-label`. Nenhum ativo, brasão, motivo de triângulo triplo ou fonte comercial
copiados de terceiros (incluindo "new-spirit-condensed"). Tema claro. Dependência nova. Comentário em
código novo.
