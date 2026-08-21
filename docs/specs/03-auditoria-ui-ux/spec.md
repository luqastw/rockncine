# Auditoria UI/UX (achados e correções)

**Status:** implementado

Rodada motivada por um pedido do usuário de rodar um agente focado em UI/UX no projeto inteiro.
Sem um subagente dedicado disponível na sessão no momento, a auditoria rodou via agente
general-purpose com a skill `frontend-design` carregada como lente de crítica, lendo o SPEC.md
inteiro como fonte de intenção e o código real de todos os componentes de sala/auth/player. Nove
achados, priorizados; o usuário pediu pra corrigir todos, exceto o de prioridade baixa sobre o
conjunto de emojis de reação (decisão explícita do próprio usuário numa rodada anterior — não é
bug, não foi alterado).

**1. Alvos de toque abaixo do piso de 44px de `docs/specs/01-fundacao-mvp/spec.md`, seção 8 — corrigido.** Violado em
`PlayerControls.tsx` (play/pause, mutar, tela cheia — todos `h-9 w-9`=36px),
`RoomActions.tsx` (teatro `h-7 w-7`=28px; carregar vídeo sem altura mínima, ~28px),
`Chat.tsx` (emojis de reação, `h-8 w-8`=32px) e `LoadVideoModal.tsx` (fechar, `h-8 w-8`=32px).
Todos subiram pra `h-11 w-11`/`min-h-11` (44px). O scrubber de progresso e o slider de volume
(`PlayerControls.tsx`) continuam visualmente finos (`h-1`, é a barra que faz sentido ver) mas
ganharam área de toque de 44px via `style={{ boxSizing: "content-box" }}` + `py-5` — content-box
pontual pra padding somar à altura em vez de ser espremido pelo `border-box` padrão do Tailwind.
A fileira de emojis do chat ganhou `flex-wrap` pra não estourar a largura do aside estreito
(`lg:min-w-72`=288px) agora que cada botão ocupa 44px.

**2. `--ink-muted` abaixo do piso AA de contraste — corrigido.** `#7A7A7A` sobre `--bg-surface`
(`#141414`) media ~4,29:1, abaixo dos 4,5:1 que a seção 8 chama de "não-negociável". Era o token
usado em timestamp do chat, "(você)", placeholders e labels de seção dentro de qualquer painel
`bg-surface`. `app/globals.css`: `--gray-500` subiu de `#7A7A7A` pra `#828282` (~4,8:1 sobre
`--bg-surface`, ~5,15:1 sobre `--bg-void` — melhora nos dois fundos, não só no que falhava).

**3. `LoadVideoModal` sem semântica de dialog nem trap de foco — corrigido.**
`components/room/player/LoadVideoModal.tsx` não tinha `role="dialog"`/`aria-modal`, Tab escapava
pro conteúdo da sala atrás do overlay, e o foco não voltava pro botão que abriu o modal ao fechar.
Adicionado: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apontando pro título; trap de
foco simples no `keydown` já existente (Tab/Shift+Tab cicla entre primeiro e último elemento
focável do painel); `triggerRef` captura `document.activeElement` no efeito que reage a `open` e
devolve o foco ali ao fechar (por Escape, clique fora, ou envio com sucesso — todos passam por
`onClose`).

**4. Tela cheia + teatro empilhados abaixo de `lg` — layout quebrava de verdade, corrigido.**
A fórmula de altura máxima do vídeo em tela cheia (`docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.1) assume as duas colunas lado a lado; abaixo
de `lg` o stage vira `flex-col` e o vídeo (`flex-1`) disputa altura com o `aside` no mesmo eixo, sem
a fórmula descontar o espaço do aside — o chat ficava espremido a uma fresta ou cortado pelo
`overflow-hidden` do stage. Como o botão de teatro (`RoomActions.tsx`) não tinha nenhuma
condição de viewport, um usuário de mouse com a janela mais estreita que `lg` (não só toque em
celular) conseguia alcançar essa combinação quebrada. Correção: o botão de teatro ganhou
`hidden lg:flex` — só existe como alvo clicável em `lg` (1024px) pra cima, em qualquer dispositivo.
Não muda o comportamento em telas largas; fecha a única porta pra esse estado inválido. Consistente
com `docs/specs/01-fundacao-mvp/spec.md`, seção 8: "mobile — coluna única... chat/presence colapsam abaixo, nunca disputam espaço com
o player" — em tela estreita, tela cheia já era pra ser só vídeo mesmo.

**5. Estado vazio do player sem tipografia de "Display" — corrigido.** `docs/specs/01-fundacao-mvp/spec.md`, seção 8, reserva o papel
Display pra "momentos grandes: título da sala, estados vazios". O placeholder de vídeo-não-carregado
(`RoomExperience.tsx`) era só `text-sm text-[var(--ink-muted)]`, lendo como fallback sem estilo, não
como estado intencional. Reescrito em duas linhas: título em `text-xl font-semibold tracking-tight`
("nenhum vídeo carregado") + instrução em corpo muted embaixo. Sem fonte Display de verdade
instalada no projeto (só Geist Sans/Mono via `next/font`, ver `app/layout.tsx`) — o efeito "Display"
aqui é peso/tamanho/tracking sobre a mesma sans, não uma família nova (adicionar uma fonte fica fora
do escopo desta correção).

**6. Chat sem `aria-live` — corrigido.** Mensagens novas chegavam via broadcast sem anúncio nenhum
pra leitor de tela. `Chat.tsx`: `<ul>` ganhou `role="log"` + `aria-live="polite"` +
`aria-relevant="additions"` — histórico existente não é re-anunciado, só o que chega depois.

**7. Bordas `--line` quase invisíveis como affordance de botão — corrigido nos casos citados.**
`--line` (`#2A2A2A`) sobre `--bg-void` (`#0A0A0A`) mede ~1,36:1 — abaixo do piso de 3:1 do WCAG
1.4.11 pra contorno de componente interativo. Afeta botões cuja única affordance é a borda,
sentados direto sobre `--bg-void`: `RoomActions.tsx` (carregar vídeo, teatro), a barra de
`PlayerControls.tsx` e o botão mínimo de tela cheia da 9.7 (`PlayerShell.tsx`) — este último em
particular tinha `bg-[var(--bg-void)]/90` como "preenchimento" que na prática não preenche nada
visualmente por estar sobre o próprio `--bg-void`. Todos trocaram a borda de `--line` pra
`--ink-muted` (agora ~5,15:1 sobre `--bg-void` depois do item 2) — `--line` continua valendo pra
divisor puramente decorativo (isento do 1.4.11), não foi trocado globalmente.

**8. Scrubber/volume finos demais pra toque — corrigido junto do item 1.** Ver item 1: a correção de
alvo de toque desses dois elementos é a mesma técnica (`content-box` + `py-5`), documentada lá pra
não duplicar.

**9. Conjunto de emojis de reação (❤️💔🔥😢🐔🍲) mistura reações genéricas com dois
fora do óbvio — não alterado, decisão do usuário.** `🐔`/`🍲` foram pedidos explicitamente pelo
usuário numa rodada anterior desta mesma sessão (referência de watch-party de terceiro, ver
`docs/specs/01-fundacao-mvp/spec.md`, "Decisões travadas" / histórico da sala). A auditoria sinalizou como possível ruído de affordance,
mas mudar exigiria contradizer uma escolha explícita já feita — fica registrado aqui como
avaliado-e-mantido, não como pendência.

### 10.1 Addendum: dois bugs reais achados pelo code-reviewer em cima desta correção

Segunda rodada de review (`feature-dev:code-reviewer`) sobre o commit dos itens 1–8 achou dois bugs
de verdade, não cobertos pela auditoria original.

**A. `onClose` inline em `RoomExperience.tsx` re-disparava o efeito de teclado do `LoadVideoModal` a
cada re-render alheio — CONFIRMADO, corrigido.** `RoomExperience` re-renderiza com alta frequência
enquanto o modal está aberto (assina `useStorage` de `video`/`player`, `useStatus`,
`useLastRoomEvent`, `useRoomJoinAnnouncement` — todo tráfego do Liveblocks: chat, presença, sync).
O efeito de Escape/Tab-trap do modal tinha `onClose` no array de deps; como
`onClose={() => setLoadModalOpen(false)}` era recriado a cada render do pai, o efeito
desmontava/remontava a cada evento não-relacionado enquanto `open` continuava `true` — limpando
`error` e roubando o foco de volta pro input da URL no meio de qualquer coisa que o usuário
estivesse fazendo (ex. digitando, focado no botão de fechar). Corrigido em dois lugares:
`RoomExperience.tsx` ganhou `closeLoadModal = useCallback(() => setLoadModalOpen(false), [])`
(identidade estável) passado como `onClose`; e, defesa em profundidade, `LoadVideoModal.tsx` parou
de depender de `onClose` no efeito de teclado — guarda a versão mais recente num `onCloseRef`
atualizado por um efeito próprio, e o listener de `keydown` agora depende só de `open`. Efeito
colateral: o "limpar erro + focar input" também saiu do mesmo efeito pra um efeito próprio, com a
mesma dependência única (`open`) — não é mais re-executado por causa do `onClose`.

**B. Redimensionar a janela pra abaixo de `lg` com teatro já ligado reproduzia o mesmo layout
quebrado do item 4 — CONFIRMADO, corrigido.** O `hidden lg:flex` do item 4 fecha só a porta de
**entrar** no estado `isFullscreen && isTheater` abaixo de `lg` por clique — não existia nenhum
listener de redimensionamento, então quem já estava em tela cheia + teatro numa janela larga e
encolhia ela pra menos de 1024px (redimensionar janela de desktop, não só girar celular) ficava
preso no mesmo bug: `isTheater` continuava `true`, o stage caía pra `flex-col`, e o `aside` voltava
a disputar altura com o vídeo. Corrigido com um efeito novo em `RoomExperience.tsx`, ao lado do de
`fullscreenchange`: `matchMedia("(min-width: 1024px)")` com listener de `change` que força
`setIsTheater(false)` sempre que a viewport cruza pra baixo de `lg` — independente de estar ou não
em tela cheia no momento (inofensivo quando já é `false`).
