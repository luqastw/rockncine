# Spec: chat da sala — isolamento de estado, envio confiável e leitura do log

**Status:** em implementação
**Pesquisa:** `research.md`
**Irmãos:** `tasks.md`

---

## 1. Problema / motivação

O chat da sala é a única superfície social do produto — com voz, reação e convidado sem cadastro
descartados por decisão de produto (seção 2) — e é o caminho de entrada mais usado da sala. Hoje ele
tem três defeitos independentes, medidos (ver `research.md`):

1. **Cada mensagem recebida re-renderiza a sala inteira.** `useChat` é chamado no nível de
   `RoomExperience`, então o `setMessages` de cada item do broadcast acorda a árvore de 750 linhas:
   `PresenceList`, `SyncRing`, `PlayerShell`, `InviteCode`, `RoomActions`, `LastActionNote`. Medido
   em jsdom: 1 render de `PresenceList` por mensagem recebida, com o log cheio em 30 itens.
2. **Cada tecla no composer reconstrói as 30 linhas do log, formatando 30 horários.** `formatTime`
   chama `new Date().toLocaleTimeString()` por item, por render, sem cache de `Intl` — medido: 30
   construções de formatação por tecla. É a mesma classe de defeito que o playhead teve e que foi
   resolvido com store externa (`hooks/usePlaybackClock.ts`).
3. **Mensagem escrita durante reconexão é descartada em silêncio.** O envio não passa
   `shouldQueueEventIfNotReady` — o mesmo mecanismo que o "entrou na sala" já usa
   (`hooks/useRoomJoinAnnouncement.ts`) — então quem digita durante uma queda do socket perde a
   própria mensagem sem nenhum aviso.

E o log, com 30 itens em coluna de 272px, tem hoje autor e horário repetidos em todas as linhas,
ponto de presença idêntico para todo mundo, sem divisória de tempo, sem indicação de "onde eu
estou" quando há conteúdo acima (a barra de rolagem é escondida por decisão de design) e sem
contagem de não lidas.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Isolar o estado do feed do estado da sala, de modo que mensagem de chat não re-renderize nada
   fora do log.
2. Eliminar o trabalho por tecla no log (formatação de horário e reconciliação dos 30 itens).
3. Não perder mensagem escrita fora de `connected`, e dizer ao usuário quando o envio está em fila.
4. Deixar o log legível como conversa: agrupamento por autor, divisória de tempo, divisória de não
   lidas, identidade do participante e bolha na própria mensagem.
5. Corrigir o composer: multilinha real, Enter envia, Shift+Enter quebra, emoji na posição do
   cursor, e nenhum corte silencioso de texto.

**Não-objetivos (decisão de produto, 2026-10-03)**

- **Voz e câmera.** Descartado: o canal de voz/câmera não entra no produto.
- **Reação de emoji sobre o vídeo.** Descartado: o chat é caixa de texto.
- **Convitado sem cadastro.** Descartado: entrar na sala exige sessão (`app/rooms/[code]/layout.tsx`).
- **Persistência de histórico.** Descartado: o feed continua efêmero, com teto de 30 itens
  (spec 10, FR-015) e sem servidor de mensagens.
- **Virtualização do log.** Inviável no teto de 30: não há o que virtualizar. Se o teto subir, isto
  vira requisito, não otimização.
- **Busca no histórico.** Depende de histórico, que não existe.
- **Prévia de link (Open Graph).** Depende de fetch externo no cliente (CORS) ou de proxy no
  servidor (superfície de SSRF) — não entra aqui.
- **Áudio do player mexendo no layout do chat** e qualquer outro item fora do eixo chat.

## 3. Histórias de usuário

- **US-1**: Como participante, quero que a mensagem de quem chegou não embaralhar nem redesenhar o
  vídeo e a presença, para que a conversa não afete a sala.
- **US-2**: Como quem digita, quero que o log não peça trabalho a cada tecla, para que escrever numa
  máquina fraca não engasgue.
- **US-3**: Como quem digita durante uma queda de rede, quero saber que a mensagem está em fila, para
  não enviar de novo e não perder a frase.
- **US-4**: Como quem escreve texto longo, quero ver o quanto falta para o limite e saber que ele vai
  ser cortado, para não mandar mensagem pela metade sem querer.
- **US-5**: Como quem lê o histórico, quero distinguir as falas de cada um e saber onde estou no
  log, para acompanhar a conversa.
- **US-6**: Como participante que chegou agora, quero saber quantas mensagens me escaparam, para
  rolar até elas.
- **US-7**: Como autor da mensagem, quero ela destacada das demais, para achar minha fala no meio do
  log.

## 4. Requisitos funcionais (EARS)

### Estado e envio

- **FR-001** O estado do feed DEVE viver fora do estado React do componente de sala, em store com
  assinatura (`useSyncExternalStore`), no padrão de `hooks/usePlaybackClock.ts`.
- **FR-002** QUANDO um item do broadcast de chat for aceito, ENTÃO nenhum componente da sala fora do
  log de chat DEVE re-renderizar.
- **FR-003** O feed DEVE continuar limitado a 30 itens, com mensagens de chat e de sistema contando
  no mesmo orçamento, e o conjunto de ids vistos deve ser reconstruído a partir do que sobrou
  (spec 10, FR-015 a FR-018).
- **FR-004** QUANDO um item for anexado com `ts` anterior ao do último item do feed, ENTÃO ele DEVE
  ser inserido na posição correspondente, preservando a ordem de chegada entre itens de mesmo `ts`.
- **FR-005** ENQUANTO o cliente não estiver `connected`, o envio DEVE entrar numa fila local em vez
  de ser transmitido a um socket indisponível, e essa fila DEVE ser despejada na ordem em que foi
  escrita assim que o status voltar a `connected`.
- **FR-006** ENQUANTO o status não for `connected`, o composer DEVE exibir um aviso de que a
  mensagem será enviada quando a conexão voltar, e o campo DEVE continuar aceitando texto.
- **FR-007** O feed DEVE ser zerado na montagem e no desmontagem da sala, para que entrar em outra
  sala não mostre o histórico da anterior.
- **FR-008** `useChat` DEVE continuar devolvendo `appendMessage` para `useRoomLeaveAnnouncement`, com
  identidade estável de módulo; e NÃO DEVE devolver `messages` — a assinatura do feed passa a ser de
  `useChatFeed`, chamada dentro de `<Chat>` (divergência declarada com a spec 10, seção 7, que
  exigia a forma `{ messages, sendMessage, appendMessage }`: a forma mudou para que o estado pare de
  morar no componente de sala, que é o objeto de FR-002).

### Custo por tecla

- **FR-009** O rótulo de horário DEVE ser produzido por uma instância única de
  `Intl.DateTimeFormat`, criada no carregamento do módulo, e não por chamada de
  `toLocaleTimeString` em render.
- **FR-010** Cada item do log DEVE ser um componente memoizado, de modo que um item não re-renderize
  quando o item anterior ou a lista mudam.
- **FR-011** A digitação no composer NÃO DEVE disparar re-render de nenhum componente da sala fora
  do log.

### Leitura do log

- **FR-012** Itens consecutivos do mesmo autor, separados por menos de 5 minutos e sem mensagem de
  sistema entre eles, DEVEM ser renderizados sem repetir autor e horário no segundo em diante.
- **FR-013** Uma mensagem de sistema DEVE interromper o agrupamento.
- **FR-014** O log DEVE inserir divisória de data quando o dia da mensagem muda em relação à
  anterior.
- **FR-015** Quando houver itens recebidos enquanto o log não estava colado no rodapé, DEVE existir
  uma divisória "novas mensagens" antes do primeiro deles, e a contagem de não lidas DEVE aparecer no
  cabeçalho do chat.
- **FR-016** O log DEVE indicar que há conteúdo acima enquanto `scrollTop > 0`, já que a barra de
  rolagem é escondida por decisão de design (`app/globals.css`).
- **FR-017** A mensagem do próprio usuário DEVE ser destacada (bolha invertida, alinhada à direita),
  com contraste de texto ≥ 4,5:1 entre a bolha e o texto.
- **FR-018** Cada participante DEVE ser identificado por iniciais e por um de quatro tons de
  presença derivados do `userId`, sem matiz — a direção visual é monocromática (`app/globals.css`).
- **FR-019** A rolagem automática DEVE ser suave quando o usuário estava colado no rodapé e
  instantânea quando a mensagem é enviada por ele.
- **FR-020** A rolagem automática e as transições de movimento DEVEM ser desligadas em
  `prefers-reduced-motion` e no modo economy.
- **FR-021** O painel DEVE ter um só cabeçalho de presença: gatilho e ações da sala na mesma
  fileira, sem `<h2>presença</h2>` acima dela. *(A versão original pedia um cabeçalho único com
  título do chat, contador de não lidas, presença e ações — ver divergência na seção 8.)*
- **FR-022** Cada item do log DEVE expor autor e horário em texto só para leitor de tela, inclusive
  nos itens agrupados e nas mensagens de sistema.

### Composer

- **FR-023** O campo de mensagem DEVE ser um `textarea` que cresce até 4 linhas e passa a rolar
  internamente depois disso.
- **FR-024** A tecla Enter, sem modificador, DEVE enviar; Shift+Enter DEVE inserir quebra de linha.
- **FR-025** O campo DEVE exibir a contagem de caracteres a partir de 80% do limite e um aviso
  explícito de corte acima do limite.
- **FR-026** Nenhum envio pode ocorrer com o campo em branco ou só com espaços.
- **FR-027** A inserção de emoji DEVE respeitar a posição do cursor, e um campo que contenha apenas
  o emoji inserido DEVE enviá-lo imediatamente.
- **FR-028** O teclado virtual do mobile DEVE trazer o composer para a área visível ao focá-lo.

### Digitação

- **FR-029** A presence DEVE carregar `typing: boolean`, ligado enquanto há digitação nos últimos
  1,2 s e desligado depois disso.
- **FR-030** ENQUANTO outro participante estiver digitando, o log DEVE mostrar o nome dele uma vez,
  não uma linha por tecla.

## 5. Critérios de aceite (Given-When-Then)

### Isolamento e custo

- **AC-001** [FR-002] Given a sala montada com 30 itens no feed, When uma mensagem é recebida, Then
  um componente-contador fora do log não muda de contagem de render.
- **AC-002** [FR-009] Given o módulo do chat carregado, When o log renderiza 30 itens, Then
  `Intl.DateTimeFormat` foi construído uma única vez e nenhuma chamada a
  `Date.prototype.toLocaleTimeString` é feita pelo render.
- **AC-003** [FR-010] Given 30 itens no log, When o draft ganha um caractere, Then nenhuma
  formatação de horário acontece, os nós do log são os mesmos de antes, e um componente-contador
  fora do log não muda de contagem de render. *(A memoização do item é verificada por revisão do
  diff: "o item não re-renderizou" não é observável de fora do React em jsdom, porque um item que
  re-renderiza com a mesma saída também não toca no DOM. O que o teste mede é o efeito — nenhum
  trabalho proporcional às 30 mensagens por tecla.)*
- **AC-004** [FR-004] Given itens com `ts` 100, 200 e 150 anexados nessa ordem, When o feed é
  lido, Then a ordem é 100, 150, 200.
- **AC-005** [FR-005] Given `useStatus` igual a `reconnecting`, When duas mensagens são enviadas,
  Then `broadcastEvent` não é chamado, as duas estão no feed local, e ao virar `connected` as duas
  são transmitidas na ordem em que foram escritas.
- **AC-006** [FR-007] Given o feed com itens da sala A, When a sala B monta, Then o feed de B
  começa vazio.
- **AC-007** [FR-003] Given 40 itens distintos anexados, When o limite é atingido, Then o feed tem 30
  itens e o conjunto de ids vistos tem 30 entradas.

### Leitura

- **AC-008** [FR-012] Given três mensagens seguidas de `ana` em menos de 5 minutos, When o log
  renderiza, Then autor e horário aparecem uma vez.
- **AC-009** [FR-013] Given duas mensagens de `ana` separadas por uma mensagem de sistema, When o log
  renderiza, Then o autor aparece de novo na segunda.
- **AC-010** [FR-014] Given itens de dias diferentes, When o log renderiza, Then existe uma divisória
  com a data.
- **AC-011** [FR-015] Given o log rolado para cima, When chega uma mensagem, Then existe o texto
  "novas mensagens" no log e o cabeçalho mostra a contagem 1.
- **AC-012** [FR-016] Given o log com `scrollTop` 0, When o usuário rola para cima, Then o log passa
  a expor estado de "há conteúdo acima".
- **AC-013** [FR-017] Given uma mensagem do próprio usuário, When renderizada, Then o item tem a
  classe de destaque e está alinhado à direita.
- **AC-014** [FR-018] Given dois participantes com `userId` distintos, When renderizados, Then cada
  um tem iniciais e um tom de identidade.
- **AC-028** [FR-005] Given uma mensagem enviada pelo caminho otimista, When o mesmo id volta pelo
  broadcast, Then o feed tem um item só.
- **AC-015** [FR-020] Given `prefers-reduced-motion: reduce`, When chega mensagem com o log colado,
  Then a rolagem é aplicada com comportamento `auto`.
- **AC-016** [FR-021] Given a sala, When renderizada, Then o texto "presência" não aparece como
  cabeçalho separado, e o gatilho "N na sala" divide a fileira com as ações da sala.
- **AC-017** [FR-022] Given um item agrupado, When um leitor de tela o percorre, Then autor e
  horário estão em texto acessível.
- **AC-029** [FR-022, FR-030] Given o log como região `aria-live`, When a mensagem chega e alguém
  muda o estado de digitação, Then a árvore de anúncios do log contém as mensagens e não contém a
  divisória nem a linha de digitação (divisórias com `aria-hidden`, indicador com `aria-live="off"`).

### Composer

- **AC-018** [FR-024] Given texto no campo, When Enter é pressionado, Then a mensagem é enviada uma
  vez e o campo é limpo.
- **AC-019** [FR-024] Given texto no campo, When Shift+Enter é pressionado, Then há quebra de linha e
  nada é enviado.
- **AC-020** [FR-025] Given 450 caracteres, When o campo renderiza, Then a contagem aparece; Given
  501 caracteres, Then existe o aviso de corte.
- **AC-021** [FR-026] Given campo com espaços, When Enter é pressionado, Then nada é enviado.
- **AC-022** [FR-027] Given o cursor no meio do texto, When um emoji é inserido, Then o emoji entra
  na posição do cursor.
- **AC-023** [FR-027] Given campo vazio, When um emoji é inserido, Then a mensagem é enviada
  imediatamente.
- **AC-024** [FR-028] Given o campo focado, When o foco chega, Then o composer é trazido para a área
  visível do contêiner de rolagem mais próximo.
- **AC-025** [FR-006] Given `useStatus` igual a `reconnecting`, When o composer renderiza, Then há
  aviso visível de envio em fila e o campo aceita texto.

### Digitação

- **AC-026** [FR-029] Given digitação no campo, When 1,3 s passam sem novo caractere, Then a
  presence local tem `typing: false`.
- **AC-027** [FR-030] Given outro participante com `typing: true`, When o log renderiza, Then o nome
  dele aparece uma vez como "digitando".

## 6. Requisitos não-funcionais (quantificados)

- **Render:** 1 mensagem recebida causa 0 renders fora do log. Meta: ≤ 1 ms de trabalho de
  reconciliação por item memoizado em hardware de referência — medido em jsdom por contador de
  render, não por tempo.
- **Teclado:** 0 trabalho proporcional ao número de mensagens por tecla digitada.
- **Altura:** o bloco fixo do chat (título + composer + contador) ≤ 132px em coluna de 272px, para
  não comer o log. Com o popover de emoji, a fileira de 6×44px saiu de lá; o que ficou é o botão de
  44px ao lado do campo.
- **Acessibilidade:** alvo de toque ≥ 44px em todo controle novo; contraste ≥ 4,5:1 entre o texto e o
  fundo em todos os tons de identidade; `role="log"` com `aria-relevant="additions"` mantido. No
  log, a árvore de anúncios é só a conversa: divisórias com `aria-hidden`, indicador de digitação com
  `aria-live="off"`, e o aviso de fila com `role="status"` (uma vez, na virada de status).
- **Contrato:** `useChat` passa a devolver `{ sendMessage, appendMessage }`; `messages` é lido por
  `useChatFeed`, dentro de `<Chat>`. Nada fora de `Chat.tsx` depende da representação dos itens.
- **Cobertura de teste:** `lib/chat-feed.test.ts`, `lib/identity.test.ts`,
  `components/room/Chat.test.tsx` e `hooks/useChat.test.tsx` cobrem os AC de 1 a 27.

## 7. Dados e contratos

- Nenhuma entidade nova, nenhuma migração.
- `RoomPresence` ganha `typing: boolean` — opcional no tipo, porque uma presence antiga (outro cliente
  da mesma versão em recarga) pode não trazer o campo.
- Nenhum evento novo no `RoomEvent`: o chat continua em `CHAT_MESSAGE`/`SYSTEM_MESSAGE`, com o
  broadcast sem alteração de forma.
- Store do feed em `lib/chat-feed.ts` (lógica pura, testável sem React) e assinatura em
  `hooks/useChatFeed.ts`. A store é singleton de módulo, como a de `hooks/usePlaybackClock.ts`, e é
  zerada no ciclo de vida da sala (FR-007).
- Identidade visual em `lib/identity.ts`: iniciais e tom (0–3) derivado por hash do `userId`.

## 8. Riscos / dependências / divergências

- **Ordem de entrega em fila (FR-005).** Eventos enfileirados são despejados na reconexão e podem
  chegar depois de mensagens mais novas de outros participantes. FR-004 é a mitigação: o feed ordena
  por `ts`, então uma mensagem atrasada entra na posição certa. O efeito colateral aceito é o da
  linha "pular" de posição quando isso acontece.
- **Presence como canal de digitação.** Cada tecla muda a presence. O `typing` só vira `true` uma vez
  e desliga por timeout ocioso, e não há escrita de presence por tecla (FR-029) — o que mantinha o
  custo em um toggle, não em uma stream.
- **Divergência: V10 parcial.** FR-028 entrega `scrollIntoView` do composer ao focá-lo. O recuo do
  `visualViewport` (padding inferior igual à altura do teclado) NÃO foi implementado: o caminho
  atual é `sticky bottom-0` dentro de um contêiner que já rola, e mexer no recuo medido em device
  real (que o repositório não tem automatizado) trocaria um defeito pequeno por um risco de o campo
  sair da caixa. Reabre se aparecer medição em device de 390px.
- **Dependência do cálculo de altura do vídeo.** `RoomExperience.tsx` dimensiona a caixa do vídeo com
  `calc((100dvh-22rem)*16/9)` e a constante `22rem` é literal (o Tailwind não extrai classe
  interpolada). Qualquer mudança de altura do bloco do chat tem de acompanhar a constante — está
  em `tasks.md` como tarefa acoplada, não como detalhe.
- **`memo` éزلos, não prova.** O isolamento real vem de FR-001/FR-002. `memo` nos blocos caros é
  defesa em profundidade; o teste de AC-001 é o que prova o isolamento.
- **Alcance de `FR-018`.** Os quatro tons são cinzas derivados de `--gray-100` e `--gray-500`; todos
  passam de 4,5:1 sobre `--bg-surface` e de 4,5:1 contra `--pure-black` no texto da inicial.
- **A fila de envio é nossa, não do Liveblocks.** A primeira implementação de FR-005 usou
  `shouldQueueEventIfNotReady`, a opção que o Liveblocks oferece para enfileirar evento com socket
  fechado — e o próprio pacote a documenta como instável ("não temos certeza de querer suportar isso
  no futuro", `BroadcastOptions` em `@liveblocks/core`). Construir a confiabilidade do chat sobre
  uma opção que pode sumir é dívida que só aparece em produção, então a fila local de 50 mensagens
  a substitui: `sendMessage` decide pelo `useStatus`, e o efeito no `connected` despeja. O
  `shouldQueueEventIfNotReady` continua em `useRoomJoinAnnouncement` (pré-existente, fora do escopo
  desta spec, um evento por entrada na sala).
- **O que esta spec não consegue provar, e por quê.** Três lacunas são de ambiente, não de código,
  e estão declaradas aqui para não sumirem no próximo audit:
  1. **Duas abas reais.** A store do feed é um singleton de módulo: dois componentes no mesmo
     processo leem o mesmo feed, então um teste de "dois clientes" em um só processo só mediria o
     transporte com uma store compartilhada — teatro, não prova. A entrega por broadcast, a fila
     com queda de rede e o despejo precisam de duas abas de verdade ou de integração com o
     Liveblocks. O que o teste cobre é o que é logicamente verificável: o payload é cortado no
     mesmo teto do validador, `shouldQueueEventIfNotReady` deixou de ser usado, o envio otimista
     não duplica quando o id volta (AC-028) e a fila despeja na ordem.
  2. **Rolagem suave, auto-resize do campo e altura do painel.** `scrollTo({behavior:"smooth"})`,
     `scrollHeight` e a soma de alturas do painel só têm valor real no navegador. O que o jsdom
     garante é o argumento da chamada (behavior `auto` com `prefers-reduced-motion` ou no envio
     próprio) e que o auto-resize nunca fixa altura 0.
  3. **Leitor de tela.** `aria-hidden` nas divisórias e `aria-live="off"` no indicador de digitação
     são as ferramentas documentadas para tirar nós da árvore de anúncios, mas o resultado
     audível só se confirma com NVDA, VoiceOver ou TalkBack.
- **Divergência: cabeçalho único parcial (FR-021).** O entregue é a remoção do cabeçalho de presença
  e a fileira única gatilho + ações; o `<Chat>` manteve a própria linha de título com o contador de
  não lidas. Juntar os dois exigiria tirar o contador de não lidas do `<Chat>` para fora — uma
  segunda store só para a pílula ser desenhada na `RoomExperience`. O ganho seria uma linha de 20px
  no painel; o custo, um segundo canal de estado que precisa concordar com a rolagem. Reabre se
  houver medição de aperto de altura em device real.
- **Divergência: `memo` só onde a prop é estável.** O plano era aplicar `memo` também em
  `PlayerShell` e `PlayerControls`. Não foi feito: os dois recebem `controller`, que os hooks de sync
  recriam a cada render, e memoizar ali não segura nada. `memo` foi aplicado onde a prop é
  realmente estável (`RoomActions`, `SyncRing`, `InviteCode`) e nos itens do log.
- **A constante `22rem` não mudou.** O popover de emoji tirou 44px do bloco fixo do chat, e o cálculo
  da altura do vídeo (`RoomExperience.tsx`, `calc((100dvh-22rem)*16/9))`) trata esse bloco como PISO.
  Baixar a constante faria o vídeo crescer no layout empilhado, mas a medição que justifica 22rem
  (composer dentro da caixa a 320×700, com o selo do Liveblocks por cima) não é automatizada neste
  repositório. Os 44px a mais de log ficam sem mexer na constante; mexer nos dois só com verificação
  em device.
- **O contador de não lidas conta também mensagens de sistema.** O total é a distância até a
  primeira não lida, não a contagem de falas: uma mensagem de sistema que chega com o usuário longe
  do rodapé também conta. É o comportamento honesto — o conteúdo mudou — e evita um segundo cálculo
  com a mesma informação.