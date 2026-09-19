# Pesquisa original — Auditoria UI/UX — rodada 2

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico do diagnóstico: medições, vereditos e código citado por linha.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Auditoria UI/UX — rodada 2

**Status:** implementado

Segunda passada de auditoria no projeto inteiro, pedida pelo usuário depois das correções de
`docs/specs/03-auditoria-ui-ux/spec.md`. Diferença de método em relação à rodada anterior: além de ler o SPEC.md e o código, esta rodada
rodou o app no navegador (build de produção numa instância isolada) e mediu o DOM real —
`getBoundingClientRect`, `elementFromPoint`, `getComputedStyle`, `MutationObserver` — em vez de
inferir comportamento só do código. Foi assim que os três achados P0 mais graves apareceram: nenhum
deles é visível lendo o componente isoladamente, todos dependem de como iframe cross-origin,
z-index e altura de viewport se comportam juntos em tempo de execução.

Vinte e oito achados, priorizados P0/P1/P2. **Todos foram corrigidos**; os desvios em relação à
correção originalmente proposta estão marcados item a item, com o motivo. Referências de linha
apontam pro estado do código depois do commit desta rodada.

### 11.1 P0 — quebravam o uso básico

**1. Barra de controles inalcançável em toda fonte com iframe — corrigido com desvio.** O `wake` do
auto-hide só escutava `onMouseMove`/`onTouchStart` no wrapper do player, mas em `YOUTUBE`/`VIMEO`
esse wrapper é 100% coberto por um iframe cross-origin: eventos de ponteiro de dentro dele não
atravessam pro parent. Passados os `AUTO_HIDE_MS` (2500), não sobrava um pixel do player capaz de
trazer a barra de volta — `elementFromPoint()` no centro do player e na faixa da barra retornava
`IFRAME` nos dois casos, e a barra ficava `visibility: hidden` permanentemente; na sala aberta em
produção ela só reapareceu com um `mousemove` sintético despachado por script. Efeito real: 2,5s
depois de dar play no YouTube o usuário perdia play/pause, scrubber, volume e tela cheia, e o que
aparecia no hover era o chrome nativo do YouTube (título, compartilhar, "Mais vídeos") — exatamente
o que `docs/specs/01-fundacao-mvp/spec.md`, seção 7, diz querer esconder. Correção: camada transparente `absolute inset-0 z-10`
(`PlayerShell.tsx:85`) devolvendo a área do player ao nosso documento. **Desvio:** a camada só é
montada quando existe `PlaybackController`. Cobrir o iframe de `GENERIC_IFRAME` bloquearia o clique
que é o único controle daquela fonte, então lá a correção foi outra — barra mínima sem auto-hide,
documentada como revisão em `docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.7.

**2. Overlay de pausa do YouTube cobria a barra inteira — corrigido.** O overlay que esconde a tela
de sugestões do YouTube pausado (`docs/specs/01-fundacao-mvp/spec.md`, seção 7) era `absolute inset-0 z-10`, e a barra de controles era
`absolute` sem z-index: na ordem de pintura, positivo ganha de `z-auto` independente da ordem do
DOM. `elementFromPoint()` no centro do botão "tela cheia" retornava o `<button aria-label="tocar">`
do overlay. Como o estado logo após carregar um link é justamente "pronto e pausado", não havia como
entrar em tela cheia, buscar posição ou mexer no volume sem antes dar play. Corrigido com pilha
explícita de três camadas: captura de ponteiro `z-10` (achado 1), overlay de pausa `z-20`
(`RoomExperience.tsx:364`), barra `z-30` (`PlayerShell.tsx:93`).

**3. Player inacessível por teclado — corrigido com desvio do que a 9.3 tinha decidido.** O estado
escondido da barra usava `invisible` (decisão de `docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.3, item 5), que remove os controles da ordem de
tabulação; somado ao `wake` só de ponteiro, não existia caminho nenhum de teclado até o player
depois de 2,5s — em qualquer fonte, inclusive `DIRECT_MEDIA`, que é imune ao achado 1. Contradiz o
piso de `docs/specs/01-fundacao-mvp/spec.md`, seção 8 ("todo elemento interativo tem estado de foco visível, inclusive em navegação por
teclado"). **Desvio:** em vez de inventar um atalho de revelação, o `invisible` foi desfeito —
`pointer-events-none opacity-0 focus-within:pointer-events-auto focus-within:opacity-100`
(`PlayerShell.tsx:101`) mais `onFocusCapture={wake}` no wrapper (`:79`). A justificativa de
compositor do `invisible` era o `backdrop-filter`, que já não existe nessa barra; a nota de revisão
está registrada dentro da própria seção 9.3 pra ela não continuar lida como decisão vigente.

**4. Fora de tela cheia o vídeo não tinha teto de altura — corrigido com desvio.** A fórmula de dois
eixos da 9.1 só era aplicada quando `isFullscreen`; no layout normal a caixa era `aspect-video
w-full`, dimensionada só pela largura. Medido na sala: viewport de 810px de altura → caixa de 703px,
`main` de 813,5px, barra de rolagem vertical presente. Em 1366×768 com chrome do browser (~650px
úteis) a conta dá ~691px: o rodapé do vídeo, onde mora a barra de controles, cai abaixo da dobra e
tocar/pausar exige rolar a página. **Desvio:** o teto ficou num wrapper em volta do `SyncRing`
(`RoomExperience.tsx:323-331`), não na caixa do vídeo como a 9.1 faz em tela cheia. Aplicado na
caixa, o limite de largura descolava a moldura de sync do vídeo — a borda passava a contornar a
coluna inteira com faixas pretas dos dois lados (regressão vista no navegador durante esta mesma
rodada). Depois da correção: sem rolagem vertical, vídeo de 649px com rodapé em 750 de 810.

**5. Link colado sem `https://` era rejeitado como "link inválido" — corrigido.**
`resolveVideoUrl` chamava `new URL(rawUrl)` direto: `POST /api/resolve-embed` com
`youtu.be/aqz-KE-bpKQ` ou `www.youtube.com/watch?v=...` respondia 422 `{"error":"link inválido."}`
pra links perfeitamente válidos — que é o formato que sai ao copiar da barra de endereço do Chrome
ou de uma mensagem. `lib/video-source.ts:102` (`parseUrl`) tenta `https://` + valor quando não há
esquema. Guarda acrescentada além do plano: o palpite só é aceito se o hostname tiver ponto
(`:111`), senão qualquer texto solto ("filme legal") viraria um `GENERIC_IFRAME` quebrado em vez de
um erro honesto. `LoadVideoModal` recebeu `inputMode="url"`, `autoComplete="off"`,
`autoCapitalize="off"` e `spellCheck={false}` no campo.

### 11.2 P1 — fluxo central prejudicado

**6. Não existia caminho de convite — corrigido, com uma mudança de formato de dado junto.** O
código da sala era um `<span>` mono de 12px no canto do header, sem botão de copiar, sem link, e o
valor era o cuid de 25 caracteres do Prisma (`cmt2vist80009sb9rsiknoxgn`). Ditar isso é inviável e
copiar exige selecionar texto minúsculo com o mouse — num produto cujo fluxo central é chamar outra
pessoa pra sala. Correção em duas partes: `lib/room-code.ts` gera 8 caracteres num alfabeto sem
`0/O`, `1/I/L` e `U`, passado explicitamente no `create` (`app/rooms/new/route.ts:14`) com
retentativa em `P2002` e queda pro `@default(cuid())` do schema depois de 5 tentativas — **sem
migração**, o campo `code` já existia como `String @unique`; e `components/room/InviteCode.tsx`
copia `${origin}/rooms/${code}` com confirmação visível ("link copiado") e fallback de seleção do
texto quando o clipboard é negado (http em rede local, permissão negada). **Desvio necessário:** a
busca da sala virou `findFirst` com `mode: "insensitive"` (`app/rooms/[code]/layout.tsx:21` e
`page.tsx:17`), senão um código ditado só funcionaria com a caixa exata — o `Room.code` do banco
segue sendo a forma canônica usada no link e no `roomId` do Liveblocks, então a sala do Liveblocks
não se duplica por diferença de caixa na URL. Salas antigas com cuid continuam abrindo normalmente.

**7. Sem sair da sala, sem sair da conta, sem lista de salas — corrigido.** Dentro da sala não havia
link de volta pra `/rooms`; em `/rooms` não havia logout (a sessão NextAuth só terminava expirando)
nem listagem, apesar de `RoomMember` ser populado a cada acesso desde a fase 1. Fechou a aba sem
anotar o código: sala perdida, contradizendo a decisão travada de que a sala "permanece
indefinidamente". Agora: `components/SignOutButton.tsx` no header de `/rooms`, seção "suas salas"
lendo `RoomMember` (`app/rooms/page.tsx:21`, 20 mais recentes, marcando as próprias com "sua"), e
link `←` no header da sala (`RoomExperience.tsx:255`).

**8. Scrubber não buscava por teclado e congelava o relógio — corrigido.** `onChange` só gravava
`dragTime`; o `seek` real acontecia em `onMouseUp`/`onTouchEnd`. Alterar o range pelas setas mudava
o número e nunca buscava no vídeo, e como `displayTime = dragTime ?? controller.currentTime`, o
`dragTime` ficava preso em não-nulo e o relógio parava de acompanhar até o próximo mouseup naquele
input. `PlayerControls.tsx:47` extraiu `commitSeek` (busca + zera `dragTime`), chamado também em
`onKeyUp` (`:97`) e `onBlur` (`:100`); `aria-valuetext` passa a anunciar "m:ss de m:ss".

**9. Mobile: vídeo empurrava o chat pra fora da tela e o chat não tinha viewport próprio —
corrigido com desvio.** Abaixo de `lg` o stage empilha, e nem o `aside` nem o `ul` do chat tinham
altura: `flex-1` dentro de container de altura automática não recebe nada. Medido forçando o
empilhamento na sala real: caixa de vídeo de 892px, topo do log do chat em y=1137 com viewport de
810 e `scrollHeight` de 1320 — o chat inteiro nascia abaixo da dobra e o `ul` media 46px, então o
`overflow-y-auto` nunca ativava e quem rolava era a página, levando o player pra fora da tela.
**Desvio:** `docs/specs/01-fundacao-mvp/spec.md`, seção 8, previa "aba ou bottom sheet"; o que resolveu foi transformar a página numa
casca de altura fixa (`max-lg:h-dvh max-lg:overflow-hidden`, `RoomExperience.tsx:251`), com o vídeo
limitado a `38dvh` (`:331`) e o `aside` em `max-lg:flex-1 min-h-0` (`:433`) — só assim o `flex-1` do
chat tem espaço livre pra distribuir e o log ganha rolagem própria. Depois da correção, nas mesmas
condições: sem rolagem de página, vídeo de 306px, log de 115px com `overflow-y: auto`. O texto de
`docs/specs/01-fundacao-mvp/spec.md`, seção 8, foi corrigido pra descrever o mecanismo real, e não a aba que não existe.

**10. Sala reaberta mentia "AO VIVO" e podia buscar além do fim do vídeo — corrigido com desvio.**
Ninguém escreve `isPlaying: false` ao fechar a aba, então o storage fica travado em "tocando" quando
o último participante sai durante a reprodução: ao reabrir, o header mostrava o badge e o anel
branco pulsando sobre um player que ainda nem tinha carregado. Pior que o cosmético: o late join
calculava `currentTime + (agora - updatedAt)` sem teto, então uma sala reaberta horas depois buscava
muito além do fim e chamava `playVideo()` sem gesto do usuário. Correção em três frentes:
(a) `expectedPlaybackTime()` (`hooks/playerController.ts:21`) centraliza clamp por duração e
descarte de snapshot com mais de `STALE_SNAPSHOT_MS` (5 min), usado nos três hooks tanto no late
join quanto na correção de drift (`useYouTubeSync.ts:116`/`:240`, `useVimeoSync.ts:139`/`:233`,
`useNativeVideoSync.ts:148`/`:277`); (b) badge e `SyncRing` passam a ler `activeController.isPlaying`
(`RoomExperience.tsx:173`) em vez do snapshot cru — com sync funcionando, estado local é estado da
sala, e quando o autoplay é bloqueado pelo browser a UI diz "pausado" em vez de mentir; (c) um
`pagehide` (`:189`) devolve o flag pra `false`. **Desvio no item (c):** só quando `othersCount === 0`
(`:186`). Zerar o flag com gente assistindo faria a correção de drift dos outros calcular
`expected` congelado e puxar o vídeo pra trás — o caso de dois saindo ao mesmo tempo fica coberto
pela regra de staleness do item (a).

**11. Estado vazio falso enquanto o storage carregava — corrigido com desvio.** `useStorage`
devolve `null` até o storage do Liveblocks sincronizar, e o componente tratava isso como "sala sem
vídeo": o primeiro paint de uma sala que já tem vídeo era o estado vazio dizendo pra carregar um.
Agora `storageLoading` (`RoomExperience.tsx:143`) distingue os dois casos e renderiza skeleton.
**Desvio:** o `ClientSideSuspense` do `@liveblocks/react`, que seria o caminho idiomático, exigiria
migrar todos os hooks de sync pra API `@liveblocks/react/suspense` — refatoração desproporcional
pro problema. Verificado no HTML do primeiro paint: contém "carregando a sala" e não contém "nenhum
vídeo carregado".

**12. Contorno de campos de formulário em `--line` — corrigido.** O item 7 de `docs/specs/03-auditoria-ui-ux/spec.md`
trocou a borda só nos botões. Nos inputs, `--line` (#2A2A2A) sobre `--bg-void` dá 1,36:1 e o preenchimento
`--bg-surface` sobre `--bg-void` dá 1,23:1 — nenhum dos dois chega aos 3:1 do WCAG 1.4.11, e nas
telas de login/cadastro o input é o componente principal. Trocados pra `--ink-muted` em
`LoginForm`, `RegisterForm`, `JoinRoomForm` (input e botão "entrar", que também tinha ficado de
fora), `Chat` (`:135`), `CreateRoomForm` e `LoadVideoModal`. `--line` segue valendo pra divisor e
moldura de painel, que são decorativos e isentos do 1.4.11.

**13. O scrubber não comunicava progresso — corrigido.** Com `accent-[var(--ink)]`, o Chrome pinta a
parte reproduzida em quase-branco e o resto no track claro padrão: sobre fundo escuro os dois ficam
indistinguíveis, e num player que esconde o chrome nativo essa é a informação principal da barra —
consequência direta da paleta monocromática, onde o accent branco colide com o default do browser.
Agora o track dos pseudo-elementos é transparente (`.range-mono`, `app/globals.css:78-110`) e quem
desenha o progresso é um `linear-gradient` no background do próprio input, com `background-clip:
content-box` pra pintar só a faixa de 4px e não a área de toque de 44px (`PlayerControls.tsx:55`).
Vale pro scrubber e pro slider de volume.

### 11.3 P2 — polimento e acessibilidade

**14. Chat forçava rolagem ao fundo mesmo com o usuário lendo o histórico — corrigido.**
`Chat.tsx:56` passou a acompanhar se a lista está a menos de `PIN_THRESHOLD_PX` (48) do fim; só
nesse caso o efeito de mensagem nova cola no rodapé. Fora dele aparece "novas mensagens ↓"
(`:93`), que rola e re-cola. Enviar mensagem sempre re-cola (`:124`).

**15. Erros e mudanças de conexão não eram anunciados — corrigido.** `role="alert"` nos blocos de
erro de `LoginForm`, `RegisterForm` e `LoadVideoModal`; `role="status" aria-live="polite"` no rótulo
de conexão/pausado (`RoomExperience.tsx:277` e `:283`). O chat já tinha `role="log"` desde
`docs/specs/03-auditoria-ui-ux/spec.md`.

**16. Formulários de auth sem `autoComplete` — corrigido.** `email`, `current-password`,
`new-password` e `name` nos campos de `LoginForm`/`RegisterForm`: gerenciador de senha volta a
preencher e a oferecer salvar, e o cadastro deixa de correr o risco de ser autofillado com a senha
antiga.

**17. Botão de play sobre o vídeo pausado sem anel de foco — corrigido.** Era `focus:outline-none`
sem anel nenhum, num alvo que ocupa a tela inteira do player e, no estado pausado, é o único
controle acessível. `RoomExperience.tsx:364` usa `focus-visible:ring-4 focus-visible:ring-inset` —
`inset` porque o botão sangra até a borda da caixa.

**18. `<iframe>` genérico sem nome acessível — corrigido.** `GenericIframe.tsx` ganhou
`title="player de vídeo incorporado"`; antes leitores de tela anunciavam "frame" sem contexto.

**19. Tela cheia silenciosamente inoperante no iOS Safari — corrigido com desvio.**
`requestFullscreen` não existe pra elemento comum no Safari do iPhone, e o optional chaining
transformava o clique em no-op sem retorno nenhum. **Desvio:** em vez de esconder o botão (que
tiraria junto o acesso ao modo teatro, único caminho até o chat em tela cheia), há fallback de tela
cheia por CSS — `cssFullscreen` (`RoomExperience.tsx:76`) põe o stage em `fixed inset-0 z-50`
(`:301`) quando `document.fullscreenEnabled` é falso, com Escape saindo (`:209`). `isFullscreen`
passou a ser `nativeFullscreen || cssFullscreen` (`:77`), então 9.1/9.2 continuam valendo sem
mudança.

**20. Título da sala em `text-sm` — corrigido.** `docs/specs/01-fundacao-mvp/spec.md`, seção 8, reserva o papel Display pro título da
sala, e ele estava do mesmo tamanho de qualquer texto de corpo, com nome, código e badge
concorrendo no mesmo peso. Agora `text-lg font-semibold tracking-tight`
(`RoomExperience.tsx:260-262`), com o código rebaixado a metadado ao lado do botão de convite. Como
no item 5 de `docs/specs/03-auditoria-ui-ux/spec.md`, "Display" aqui é peso/tamanho/tracking sobre a mesma sans — não há família nova
instalada.

**21. Placeholder usado como label — corrigido.** `aria-label` no campo de mensagem do chat, no
código da sala (`JoinRoomForm`) e no link do `LoadVideoModal`; `<label>` com `htmlFor` (visualmente
`sr-only`) no nome da sala em `CreateRoomForm`. Antes a instrução sumia ao digitar e o único rótulo
tinha contraste de metadado.

**22. Barra de controles estourava em largura estreita — corrigido.** Somando play (44) + mudo (44)
+ volume (64) + tela cheia (44) + relógio + `gap-3` + padding, a barra tinha ~370px de mínimo contra
~296px úteis num viewport de 360px: o scrubber era espremido a zero e o resto transbordava. Abaixo
de `sm`, o slider de volume (`PlayerControls.tsx:131`) e a duração total (`:84`) saem, e os gaps
caem pra `gap-2`/`px-2` (`:64`).

**23. Sem `loading.tsx`/`error.tsx` e sem pendência ao criar sala — corrigido.**
`app/rooms/[code]/loading.tsx` cobre as duas consultas de Postgres (layout + page) que antes rodavam
sem retorno visual nenhum; `app/error.tsx` substitui a tela de erro default do Next pela linguagem
visual dos `not-found` já estilizados; e `components/CreateRoomForm.tsx` isola o form de criação num
client component só pra ter estado de pendência — antes dava pra clicar duas vezes e criar duas
salas. O POST nativo com redirect 303 de `docs/specs/01-fundacao-mvp/spec.md`, seção 3, não mudou.

**24. Anel de foco com `ring-offset` errado dentro do aside em modo teatro — corrigido.** Em
`isFullscreen && isTheater` o `aside` vira `bg-[var(--bg-surface)]`, mas os controles internos
declaravam `ring-offset` em `--bg-void`, desenhando um halo escuro sobre a superfície clara. Criado
o token `--focus-offset` (`app/globals.css:35`, default `--bg-void`), consumido por `Chat`,
`RoomActions` e `InviteCode`, e redeclarado no `aside` quando ele muda de superfície
(`RoomExperience.tsx:430`).

**25. Badge do Liveblocks colidindo com a barra de controles — corrigido.** `docs/specs/01-fundacao-mvp/spec.md`, seção 6, escolheu
`bottom-left` pra sair de baixo do chat, mas o badge passou a sobrepor o canto inferior esquerdo da
caixa do vídeo, encostando no botão de play/pause. Como ele é obrigatório no plano Free e não pode
ser escondido, o que mudou foi o espaço: `<main>` reserva `pb-14` (`RoomExperience.tsx:251`), e esse
mesmo valor entra no desconto de 10rem do teto de altura do achado 4. Verificado: badge inteiramente
abaixo da caixa do vídeo.

**26. Presença sem contagem e duplicando o mesmo usuário — corrigido.** `useOthers()` lista por
conexão, então a mesma pessoa com duas abas aparecia duas vezes, sem indicação. `PresenceList.tsx`
deduplica por `presence.userId` (ignorando outras conexões do próprio usuário) e mostra "N na sala",
que era o "● ● ● 3" do esquema de `docs/specs/01-fundacao-mvp/spec.md`, seção 8, e nunca tinha sido implementado.

**27. Nenhum atalho de teclado no player — corrigido.** Espaço/`k` (play-pause), `←`/`→`
(±`SEEK_STEP_S` = 5s), `m` (mudo) e `f` (tela cheia) num listener de `keydown` a nível de sala
(`RoomExperience.tsx:194-237`), ignorado quando o foco está em `input`/`textarea`/`contenteditable`
ou o modal está aberto — senão espaço e `f` viravam caracteres perdidos no meio de uma mensagem.

**28. `lastActorId` existia no storage e não aparecia em lugar nenhum — corrigido.** Numa sala em
que qualquer um controla o player (decisão travada), o vídeo parar sem explicação é o evento mais
confuso do produto. `components/room/LastActionNote.tsx` traduz o último evento de player em "fulano
pausou / deu play / mudou a posição / carregou um vídeo" abaixo do título, some depois de 6s, e
resolve o nome via `useOthers` dentro do próprio componente — não em `RoomExperience`, pra não
assinar presença no componente que renderiza a sala inteira (mesma preocupação de re-render de
`docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.3, item 2).

### 11.4 Verificação e limites desta rodada

Reverificados no navegador contra o build de produção, com medição no DOM e não só a olho: 1
(`MutationObserver` registrando a barra voltar a `opacity: 1` com mouse real sobre a área do
iframe), 2 (`elementFromPoint` no botão de tela cheia), 4 (`scrollHeight == innerHeight`), 5 (link
sem esquema carregando o player), 6 (sala nova nascendo com código de 8 caracteres e botão de
copiar), 9 (emulando as regras de mobile: variante `lg:` removida do wrapper, stage em coluna, main
de altura fixa), 10 (recarga durante a reprodução mostrando "pausado" honesto e posição preservada),
11 (HTML do primeiro paint), 13 (zoom no scrubber) e 25 (geometria do badge). Vistos em tela de
passagem: 7, 12, 20, 26.

Corrigidos e checados só por tipo/lint/leitura, **sem exercício no navegador**: 3, 8, 14, 15, 16,
17, 18, 19, 21, 22, 23, 24, 27, 28. Os dois achados de viewport estreito (9 e 22) não foram testados
em dispositivo real de 390px — a verificação emulou as regras CSS numa janela larga, o que valida a
mecânica de layout mas não o toque real nem a barra de endereço dinâmica de browser mobile. Fica
como pendência explícita pra próxima rodada, junto com os itens 3, 4 e 6 de `docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.3 (drift, cooldown e
`overflow-hidden` na caixa do vídeo), que continuam sem medição e sem correção.
