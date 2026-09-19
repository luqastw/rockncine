# Spec: Auditoria UI/UX

**Status:** implementado
**Pesquisa:** `research.md`

## 1. Problema / motivação

Uma rodada de auditoria de UI/UX foi rodada sobre o projeto inteiro (skill `frontend-design` como lente de crítica, lendo o `SPEC.md` como fonte de intenção e o código real de todos os componentes de sala/auth/player). A auditoria produziu nove achados priorizados; o usuário pediu para corrigir todos, exceto o de prioridade baixa sobre o conjunto de emojis de reação (decisão explícita do próprio usuário numa rodada anterior). Uma segunda passada de code review sobre o commit das correções achou dois bugs reais não cobertos pela auditoria original. Esta spec fixa os contratos de acessibilidade, contraste, layout e robustez de foco que a rodada estabeleceu.

## 2. Objetivos e não-objetivos

**Objetivos**
- Levar os alvos de toque dos controles ao piso de 44px de spec 01, seção 8.
- Corrigir o contraste de `--ink-muted` para AA.
- Dar semântica de dialog, trap de foco e devolução de foco ao modal de carregar vídeo.
- Fechar as portas para o layout quebrado de fullscreen + teatro abaixo de `lg` (clique e resize).
- Fazer o estado vazio do player usar o papel "Display".
- Anunciar mensagens novas do chat para leitores de tela.
- Tornar visível o contorno de botões cuja única affordance é a borda sobre `--bg-void`.
- Eliminar o roubo de foco do modal causado por `onClose` recriado a cada render.

**Não-objetivos**
- Não alterar o conjunto de emojis de reação (decisão do usuário — avaliado-e-mantido).
- Não adicionar uma fonte Display de verdade (fica fora do escopo desta correção; usa-se peso/tamanho/tracking sobre a sans existente).
- Não trocar `--line` globalmente (ela continua válida para divisores puramente decorativos).
- Não introduzir dependência de trap de foco (o trap é implementado à mão no `keydown`).

## 3. Histórias de usuário

- **US-1** — Como usuário em tela de toque/mobile, quero alvos de toque com pelo menos 44px, para acertar os controles.
- **US-2** — Como usuário, quero texto de painel legível, com contraste AA.
- **US-3** — Como usuário de teclado/leitor de tela, quero o modal de carregar vídeo com semântica de dialog e foco preso dentro dele.
- **US-4** — Como usuário de janela estreita, quero que fullscreen + teatro não quebre o layout.
- **US-5** — Como usuário, quero que o estado vazio do player pareça intencional.
- **US-6** — Como usuário de leitor de tela, quero ser avisado das mensagens novas do chat.
- **US-7** — Como usuário, quero que botões sobre o fundo base tenham contorno visível.
- **US-8** — Como usuário de teclado, quero que o modal não roube o foco a cada re-render da sala.

## 4. Requisitos funcionais (EARS)

- **FR-001** O sistema DEVE dar alvo de toque de pelo menos 44px aos controles: play/pause, mutar e tela cheia de `PlayerControls`, teatro e carregar vídeo de `RoomActions`, emojis de `Chat` e fechar de `LoadVideoModal`.
- **FR-002** O scrubber de progresso e o slider de volume DEVEM permanecer visualmente finos (`h-1`) e ganhar área de toque de 44px via `style={{ boxSizing: "content-box" }}` + `py-5`.
- **FR-003** A fileira de emojis do chat DEVE ter `flex-wrap` para não estourar a largura do aside estreito.
- **FR-004** O token `--ink-muted` DEVE ser `#828282` (elevado de `#7A7A7A`), de modo a atingir contraste AA tanto sobre `--bg-surface` quanto sobre `--bg-void`.
- **FR-005** `LoadVideoModal` DEVE ter `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o título; o `keydown` já existente DEVE prender o foco (Tab/Shift+Tab ciclando entre o primeiro e o último focável do painel); um `triggerRef` DEVE capturar `document.activeElement` ao abrir e devolver o foco lá ao fechar.
- **FR-006** O botão de teatro DEVE ter `hidden lg:flex` — só existe como alvo clicável a partir de `lg` (1024px).
- **FR-007** SE a viewport cruzar para abaixo de 1024px, ENTÃO o sistema DEVE forçar `isTheater = false`, via `matchMedia("(min-width: 1024px)")` com listener de `change`, independentemente de estar em tela cheia.
- **FR-008** O estado vazio do player DEVE usar o papel "Display": título em `text-xl font-semibold tracking-tight` ("nenhum vídeo carregado") + instrução em corpo muted abaixo.
- **FR-009** O `<ul>` do chat DEVE ter `role="log"`, `aria-live="polite"` e `aria-relevant="additions"`, de modo que só o que chega depois seja anunciado.
- **FR-010** Botões cuja única affordance é a borda, sentados sobre `--bg-void`, DEVEM usar `--ink-muted`; `--line` DEVE ser mantida apenas para divisores puramente decorativos.
- **FR-011** O `onClose` passado ao modal DEVE ter identidade estável (`useCallback(() => setLoadModalOpen(false), [])`) e o efeito de teclado do modal DEVE depender só de `open`, guardando a versão mais recente de `onClose` num `onCloseRef` atualizado por efeito próprio.
- **FR-012** O efeito que limpa o erro e foca o input DEVE depender só de `open` (efeito próprio), não sendo re-executado por mudança de `onClose`.
- **FR-013** O conjunto de emojis de reação ❤️💔🔥😢🐔🍲 NÃO DEVE ser alterado (avaliado-e-mantido por decisão do usuário).

## 5. Critérios de aceite (Given-When-Then)

- **AC-001** Dado o app em viewport mobile, quando se mede play/pause, mutar, tela cheia, teatro, carregar vídeo, emojis e fechar modal, então cada alvo mede ≥ 44×44 px.
- **AC-002** Dado o scrubber renderizado com `h-1`, quando se mede sua caixa clicável, então ela tem altura ≥ 44px (resultado de `content-box` + `py-5`).
- **AC-003** Dado `--ink-muted` `#828282` sobre `--bg-surface` `#141414` e sobre `--bg-void` `#0A0A0A`, quando se calcula o contraste, então é ≥ 4,5:1 nos dois fundos.
- **AC-004** Dado o modal aberto com o foco no último elemento focável, quando se pressiona Tab, então o foco vai para o primeiro (e Shift+Tab no primeiro vai para o último).
- **AC-005** Dado o modal aberto a partir de um botão, quando ele fecha (Escape, clique fora ou envio com sucesso), então o foco retorna ao botão que o abriu.
- **AC-006** Dado o app em viewport < 1024px, quando a barra renderiza, então o botão de teatro não existe como alvo clicável (`hidden`).
- **AC-007** Dado fullscreen + teatro ligado em viewport ≥ 1024px, quando a janela é redimensionada para < 1024px, então `isTheater` passa a `false` e o `aside` deixa de disputar altura com o vídeo.
- **AC-008** Dado a sala sem vídeo carregado, quando ela renderiza, então aparece "nenhum vídeo carregado" em `text-xl font-semibold tracking-tight` com uma instrução muted abaixo.
- **AC-009** Dado que uma mensagem nova chega por broadcast, quando ela é renderizada, então é anunciada (`aria-live="polite"`); o histórico já existente não é re-anunciado.
- **AC-010** Dado um botão de `RoomActions` sobre `--bg-void`, quando se mede o contorno, então ele usa `--ink-muted` (contraste ≥ 3:1 sobre o fundo).
- **AC-011** Dado o modal aberto e o componente pai re-renderizando a cada evento do Liveblocks, quando chega qualquer evento não relacionado, então o efeito de teclado do modal não re-roda (não limpa o erro nem rouba o foco).
- **AC-012** Dado o conjunto de emojis de reação, quando ele é revisitado, então permanece ❤️💔🔥😢🐔🍲 (não alterado).

## 6. Requisitos não-funcionais (quantificados)

- **NFR-001** Alvos de toque ≥ 44×44 px.
- **NFR-002** Contraste de `--ink-muted` ≥ 4,5:1 (texto) e contorno de componente interativo ≥ 3:1 (WCAG 1.4.11).
- **NFR-003** `--line` (#2A2A2A) sobre `--bg-void` (#0A0A0A) = ~1,36:1 (abaixo de 3:1 → não pode ser affordance de componente).
- **NFR-004** Breakpoint `lg` = 1024 px.
- **NFR-005** Largura mínima do aside em `lg` (`lg:min-w-72`) = 288 px.
- **NFR-006** 9 achados auditados: 8 corrigidos e 1 avaliado-e-mantido.

## 7. Dados e contratos

**Modal (`LoadVideoModal`).** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → título; `triggerRef` guarda `document.activeElement` ao abrir e foca de volta ao fechar; `panelRef` delimita o ciclo de Tab/Shift+Tab; `onCloseRef` mantém o `onClose` mais recente fora das deps; o listener de `keydown` depende só de `[open]`.

**Guarda de viewport do teatro.** `matchMedia("(min-width: 1024px)")` com listener de `change` que chama `setIsTheater(false)` quando `!e.matches`; botão de teatro com `hidden lg:flex`.

**Estado vazio.** Duas linhas: título `text-xl font-semibold tracking-tight` e instrução `text-sm text-[var(--ink-muted)]`.

## 8. Riscos / dependências

- **Trap de foco manual:** cobre Tab/Shift+Tab entre focáveis do painel; não é uma lib de focus-trap. Regressões dependem do conjunto de focáveis dentro do painel.
- **Contraste:** `--ink-muted` melhora os dois fundos, mas tokens de affordance dependem de o elemento estar sobre `--bg-void`; sobre `--bg-surface` a análise é outra.
- **Emojis:** mantidos por decisão explícita do usuário; qualquer revisão futura reabre uma escolha já feita.
- **Fonte Display:** o papel "Display" é emulado com peso/tamanho/tracking sobre Geist Sans (`next/font`); não há família Display instalada.

## Anexo A — numeração legada (âncoras citadas pelo código)

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| seção 10 | Auditoria UI/UX — achados 1–9 e addendum 10.1 | FR-001 a FR-013 | components/room/RoomExperience.tsx:123, components/room/RoomExperience.tsx:158, components/room/player/LoadVideoModal.tsx:29, components/room/RoomActions.tsx:66, app/globals.css:11 |
