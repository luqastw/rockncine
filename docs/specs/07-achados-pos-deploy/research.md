# Pesquisa original — Achados pós-deploy (teste real do usuário)

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico do diagnóstico: medições, vereditos e código citado por linha.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Achados pós-deploy (teste real do usuário)

**Status: pendente — spec pronta, implementação não iniciada.** Único dos sete specs do projeto
ainda não implementado; os demais (`01` a `06`) já estão no ar.

Rodada motivada por teste manual do usuário em produção, sete pedidos concretos (print anexado ao
item 14.1). Cada subseção é spec de implementação — nenhum código foi escrito nesta rodada, só
leitura/diagnóstico contra o estado atual do repo. Convenção mantida de `docs/specs/02-fullscreen-lag-qualidade/spec.md`: verdito explícito
(CONFIRMADO / A CONFIRMAR / DESCARTADO) sempre que a causa depender de comportamento observável, não
só de leitura de código.

### 14.1 Chat sem teto de altura fora de tela cheia — CONFIRMADO

**Sintoma do print:** lista de mensagens cresce sem limite conforme chega texto, sem scrollbar
interna — a página inteira estica.

**Causa, por leitura de código.** `Chat.tsx:63` já tem `overflow-y-auto` no `<ul>` do log — a
intenção de rolagem interna existe. Mas rolagem interna só funciona se algum ancestral tiver altura
*definida*, não só `min-height`. Em `lg+`, `<main>` (`RoomExperience.tsx:259`) é
`min-h-dvh flex flex-col ...` — sem `h-dvh`/`overflow-hidden`, só `max-lg:h-dvh max-lg:overflow-hidden`
(a correção de altura fixa existe, mas só abaixo de `lg`, ver `docs/specs/01-fundacao-mvp/spec.md`, seção 8, "Mobile"). Em `lg+` a altura de
`main` é intrínseca ao conteúdo: o `stage` (`:300`, `min-h-0 flex-1`) recebe altura real via
`flex-1` **só quando o pai tem altura fixa pra distribuir** — sem isso, `flex-1` não trava nada, o
`aside`/`Chat` cresce e empurra `main` pra baixo do viewport, e o `overflow-y-auto` do item acima
nunca tem uma caixa fechada onde agir. Fora de fullscreen, é exatamente o vazamento do print.

Em tela cheia (`isFullscreen`), o próprio `stage` ganha `h-dvh w-dvw overflow-hidden`
(`RoomExperience.tsx:307-309`) — isso já dá altura real e deveria conter o chat pelo mesmo mecanismo
que funciona no mobile empilhado. **Não achei, por leitura de código, o mesmo vazamento dentro de
fullscreen** — se persistir depois da correção abaixo, é outra causa (candidato: `cssFullscreen`
seria o mais provável de escapar, por depender de `fixed inset-0` em vez da Fullscreen API nativa) e
precisa de reprodução em vez de suposição.

**Correção.** Estender pra `lg+` o mesmo tratamento que `max-lg` já tem em `main`
(`RoomExperience.tsx:259`): trocar `max-lg:h-dvh max-lg:overflow-hidden max-lg:pb-4` por uma versão
sem prefixo (`h-dvh overflow-hidden`, ajustando o `pb-14`/`pb-4` que hoje diverge entre os dois casos
pra não regredir o respiro do badge do Liveblocks — `docs/specs/01-fundacao-mvp/spec.md`, seção 6). Com `main` de altura travada em
qualquer breakpoint, a cadeia `flex-1`/`min-h-0` que já existe do `stage` até o `<ul>` do chat passa
a ter uma caixa real pra distribuir, e `overflow-y-auto` (já implementado) assume a rolagem sozinho.
Nenhuma mudança dentro de `Chat.tsx` é necessária.

**Verificação pós-fix:** reproduzir o print (mandar ~20 mensagens curtas seguidas) em `lg+` fora de
fullscreen, depois repetir dentro de fullscreen nativo e no fallback `cssFullscreen` — os três casos
citados no pedido do usuário ("tanto no fullscreen quanto sem").

### 14.2 Presença não atualiza ao fechar o navegador + mensagem de saída

**O que já funciona.** `PresenceList` (`PresenceList.tsx`) deriva a lista inteiramente de
`useOthers()` — não há estado próprio de "quem está online" desincronizado da conexão real do
Liveblocks. Quando uma aba fecha normalmente (frame de close do WebSocket chega ao servidor), os
outros clientes já devem ver a lista encolher sozinha, sem código nosso — "identificar se ainda está
online" já é, por construção, o que `useOthers()` responde.

**O que falta, dois itens concretos:**

1. **Nenhuma mensagem de sistema quando alguém sai.** Existe o par de "entrou"
   (`useRoomJoinAnnouncement.ts`, broadcast explícito no mount), mas não o de "saiu". Pedido do
   usuário: fechar essa assimetria.
2. **Sem confirmação empírica de quão rápido a saída se reflete em queda abrupta de conexão**
   (navegador fechado à força, processo morto, rede caindo sem enviar o frame de close) — nesses
   casos a detecção depende do heartbeat/timeout interno do servidor Liveblocks, não documentado
   publicamente com precisão de milissegundos. **Não tratar isso como bug nosso corrigível**: não há
   protocolo de heartbeat próprio no client hoje, e implementar um só pra apertar essa janela é
   escopo novo, não o pedido original ("verificar se ainda está online" já é respondido por
   `useOthers`; o gap real e acionável é a mensagem de saída do item 1).

**Decisão de design pro "saiu da sala": detecção local via `useOthersListener`, sem broadcast.**
Broadcast simétrico ao de entrada (a própria pessoa que sai avisando ao sair) é estruturalmente
frágil aqui: o disparo teria que rodar em `pagehide`/`beforeunload`, exatamente o momento em que o
socket está sendo derrubado — sem garantia de entrega. Em vez disso, usar
`useOthersListener(({type, user}) => ...)` do Liveblocks: cada cliente já conectado recebe localmente
um evento `{type: "leave"}` quando a conexão de outro participante cai, de forma determinística (é o
mesmo mecanismo que já alimenta `useOthers()`). Cada cliente conectado então adiciona, só no próprio
feed local (mesmo padrão de "chat não persiste, reconstituído por sessão" de `docs/specs/01-fundacao-mvp/spec.md`, seção 2 — sem broadcast,
sem risco de N cópias duplicadas de "fulano saiu" vindas de N observadores), um item
`SYSTEM_MESSAGE` "{name} saiu da sala" via o mesmo `appendUnique` que `useChat.ts` já expõe.

**Anti-flicker obrigatório.** Um refresh de página ou uma queda de rede breve gera
`leave` seguido de `enter` do mesmo `userId` em poucos segundos — sem tratamento, isso mostraria
"fulano saiu" + "fulano entrou" a cada F5. Segurar o `leave` num timer curto (ordem de alguns
segundos) antes de emitir a mensagem; se um `enter` do mesmo `userId` chegar antes do timer estourar,
cancelar e não emitir nada. Precisa de um registro local (`Map<userId, timeoutId>`) — cabe num hook
novo (`useRoomLeaveAnnouncement`, espelhando `useRoomJoinAnnouncement`), montado no mesmo nível de
`RoomExperience` (nunca dentro de `<Chat>`, pela mesma razão documentada em
`useRoomJoinAnnouncement.ts:6-9`: um unmount/remount por toggle de fullscreen/teatro não pode
reprocessar histórico de presence do zero).

### 14.3 Verificação de formato de e-mail

**Gap real:** `/api/register/route.ts:11` só valida `email.includes("@")` — `"a@"`, `"@@"` ou
`"x@y"` passam. É o único lugar server-side que decide o que vira `User.email` (`@unique` no
Postgres); os dois forms já usam `type="email"` (`RegisterForm.tsx:63`, `LoginForm.tsx:38`), que dá
alguma validação de browser, mas isso é só UX — não protege contra chamada direta à API.

**Correção:** trocar o `includes("@")` por um regex prático de formato (não RFC 5322 completo — 
implementar RFC 5322 por regex é notoriamente impraticável e fora de escopo; o pedido do usuário é
"pelo menos... a formatação correta", não validação de existência de caixa real). Padrão suficiente:
algo como `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — sem espaço, com `@`, com domínio contendo pelo menos um
`.`. Aplicar em `/api/register/route.ts` (autoritativo) mantendo a mensagem de erro já existente no
mesmo formato (minúscula, ver `docs/specs/06-consistencia-design/spec.md`, achado "quatro mensagens de erro capitalizadas... baixadas
pra minúsculo"). Login (`LoginForm.tsx`/NextAuth `authorize()`) não precisa do mesmo regex — é
lookup, não criação; formato inválido já cai em "credenciais inválidas" por não achar o `User`.

### 14.4 Presença colapsável: só contagem, detalhe sob clique

Pedido: cabeçalho de presença mostra só "N conectados"; clicar expande a lista de nomes; clicar de
novo fecha.

**Onde muda.** `PresenceList.tsx` hoje sempre renderiza a `<ul>` inteira (você + outros,
deduplicados por `userId`, `:13-40` — essa lógica de dedupe fica igual, não é o que muda). O pedido é
só sobre a forma de exibição, não sobre a fonte de dados.

**Forma:** `PresenceList` passa a controlar um `useState(false)` local de expansão. Estado fechado
(default): uma única linha resumo — `button` com `aria-expanded`/`aria-controls`, texto "N na sala" +
ícone de chevron (mesma família SVG mão-desenhada de `player/icons.tsx`, `docs/specs/01-fundacao-mvp/spec.md`, seção 8: sem lib de ícone
nova) que gira 180° no estado aberto. Clicar alterna; a lista completa (as `<li>` que já existem,
com o ponto de presença e "(você)") só monta quando `expanded === true`. Não precisa de nova consulta
Liveblocks — é puramente `useState` sobre os dados que `useOthers()`/`useMyPresence()` já entregam.

Isso é interno a `PresenceList` — o `h2` "presença" (mono, `RoomExperience.tsx:454`) e o
`RoomActions` ao lado continuam onde estão; o componente que muda de forma é só o que fica embaixo
desse cabeçalho.

Alvo de toque ≥44px pro botão-resumo, anel de foco duplo — piso de qualidade de `docs/specs/01-fundacao-mvp/spec.md`, seção 8, sem exceção
pra este componente.

### 14.5 Código da sala: 8 → 4 caracteres

Mudança de uma constante: `CODE_LENGTH = 8` → `4` em `lib/room-code.ts:10`. Alfabeto
(`ALPHABET`, `:9`) já é só maiúsculas + dígitos sem ambíguos (`0/O`, `1/I/L`, `U`) — já atende
"somente letras maiúsculas e números", não muda.

Verificado por grep: nenhum outro lugar do código assume 8 caracteres (sem `maxLength` no
`JoinRoomForm.tsx`, sem formatação hardcoded em `InviteCode.tsx`, sem checagem de tamanho em
`app/rooms/[code]/layout.tsx`). Migração de schema não é necessária — `Room.code` é `String` livre
(`prisma/schema.prisma:30`), sem `@db.VarChar(n)`.

**Consequência aritmética a registrar, não a "corrigir":** o espaço de códigos cai de 30⁸ (~656
bilhões) pra 30⁴ (810.000). O retry-on-collision que já existe
(`app/rooms/new/route.ts:11-19`, 5 tentativas antes de cair pro `cuid()` de fallback) cobre isso sem
mudança — mas com volume alto de salas simultâneas (dezenas de milhares), colisões deixam de ser
evento raro. Aceitável na escala atual por decisão explícita do usuário (ditabilidade > espaço de
nomes); não é um "bug" desta rodada, só uma troca que vale registrar caso o produto cresça.

### 14.6 Modal de "carregar vídeo" não funciona em tela cheia — CONFIRMADO

**Causa raiz, por leitura de código, não por suposição de CSS quebrado.** `<LoadVideoModal>` é
renderizado em `RoomExperience.tsx:472`, como **irmão** da `div` que é `stageRef`
(`RoomExperience.tsx:300`, fecha em `:470`) — ambos filhos diretos de `<main>`. Em Fullscreen API
nativa, só a subárvore do elemento que está de fato em tela cheia (`document.fullscreenElement`, aqui
o `stageRef`) é pintada na tela; um irmão dele fica fora da árvore renderizada enquanto a tela cheia
nativa está ativa — isso é comportamento padrão de browser (spec da Fullscreen API), não uma falha
específica desta implementação. Clicar em "carregar vídeo" dentro de tela cheia nativa abre o modal
(o estado `loadModalOpen` muda, o componente monta), só que ele não aparece em lugar nenhum — daí
"não funciona" ser a descrição exata do sintoma, sem erro no console.

**Não afeta o fallback `cssFullscreen`** (`stageRef` vira `fixed inset-0`, sem Fullscreen API real) —
lá o modal, sendo `fixed inset-0` também mas fora da árvore do stage, continua no fluxo normal do
DOM/CSS e deveria aparecer normalmente. Se o usuário testou num ambiente que cai nesse fallback (ex.
navegador sem `document.fullscreenEnabled`) e ainda assim viu falha, é caso separado — reproduzir
antes de generalizar a causa.

**Correção recomendada: mover o modal pra dentro da árvore do stage**, não criar mecanismo novo.
Renderizar `<LoadVideoModal>` como filho da `div` de `RoomExperience.tsx:300-470` (ex. logo após o
`</aside>`, ainda dentro do `stageRef`) em vez de depois dela. `position: fixed` continua resolvendo
contra o viewport normalmente quando aninhado dentro de um ancestral só com `position: fixed`/sem
`transform` (o caso de `cssFullscreen` já se comporta assim hoje) — não deveria quebrar nenhum dos
dois modos de tela cheia, e o modo não-fullscreen não muda (o modal já era `fixed inset-0` cobrindo a
tela toda de qualquer ponto do DOM). Evita introduzir portal/dependência nova, consistente com o
comentário já existente em `LoadVideoModal.tsx:7` ("sem dependência nova").

**Não remover o modal** — a causa é posicionamento de DOM, não um mecanismo quebrado; dá pra corrigir
sem trocar por alternativa.

### 14.7 Legendas do YouTube ligadas por padrão

`hooks/useYouTubeSync.ts:104` monta `playerVars` sem `cc_load_policy`. Pela IFrame Player API
(mesma referência oficial já citada em `docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.4), `cc_load_policy: 0` é o parâmetro
documentado pra manter legendas desligadas por padrão; sem ele, o comportamento default observado na
prática nem sempre é "desligado" (relato real do usuário confirma isso — a omissão não é
neutra). Correção de uma linha: adicionar `cc_load_policy: 0` ao objeto `playerVars` existente
(`{ autoplay: 0, playsinline: 1, rel: 0, controls: 0, disablekb: 1 }` → acrescentar
`cc_load_policy: 0`). Escopo só YouTube — Vimeo, mídia direta e iframe genérico não foram citados no
relato e não têm o mesmo parâmetro/mecanismo.

### 14.8 Verificação exigida ao implementar

Nenhum item acima tem código escrito ainda. Ao implementar, seguir o piso já estabelecido pelo
projeto (`docs/specs/02-fullscreen-lag-qualidade/spec.md` a `docs/specs/06-consistencia-design/spec.md`): `npm test`, `npx tsc --noEmit`, `npx eslint`, `npx next build` limpos antes de
declarar qualquer item concluído; 14.1 e 14.6 exigem reprodução em navegador real (crescimento de
altura e tela cheia nativa não são verificáveis só por leitura de classe Tailwind com a mesma
confiança que, por ex., 14.5 ou 14.7 — mudanças de constante/parâmetro único).
