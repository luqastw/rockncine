# 12 — Transmissão por screen share

## 1. Problema

O RockNCine sincroniza o player porque tem acesso à API do player. YouTube e Vimeo expõem
controle por JavaScript; mídia direta expõe `<video>`. Quando a fonte não expõe nada — o caso
`GENERIC_IFRAME` — o app cai no fallback `load-only`: iframe, sem sync, cada participante no
controle manual. O badge "sync limitado — controle manual" na tela é a materialização desse
buraco, e ele é a maior lacuna funcional do produto: é exatamente o caso de uso que justifica um
watch party (Netflix, Disney+, Prime, Twitch, qualquer coisa).

A técnica correta para fonte sem API não é extrair o stream (quebrado por DRM) nem recodificar
num servidor (custo de banda desproporcional). É o host capturar a própria tela e transmitir. O
espectador recebe os frames, e os frames **são** a sincronização: não há playhead, não há drift,
não há autoridade para arbitrar.

O requisito que molda o desenho inteiro: **o host precisa voltar para a sala para conversar
enquanto o vídeo rola em outra aba.** Isso significa que o vídeo do host não está na página da
sala — está numa aba separada que ele compartilha.

## 2. Objetivos

- O host inicia uma transmissão de tela com áudio, a partir de uma aba que ele mesmo abriu, e
  volta para a sala sem perder a transmissão.
- Todo espectador vê e ouve a transmissão, incluindo quem entra depois.
- O sistema de sincronização existente é **contornado por completo** no modo transmissão, sem
  reconciliação e sem estado duplicado.
- Nenhuma permissão de microfone. O único áudio é o que o host capturou.
- Comportamento honesto onde a plataforma não permite: Firefox sem áudio, Safari sem
  screen share. O botão some ou se desabilita com o motivo — nunca habilitado e inerte.

## 3. Não-objetivos

- **Não** é voz de participant. Nenhum `getUserMedia` de microfone, nenhum mute, nenhum indicador
  de quem fala. Conversa é o chat de texto que já existe na sala.
- **Não** extrai stream. Nenhum `yt-dlp`, nenhum proxy, nenhuma decriptação. O navegador do host
  decodifica o que ele, logado, pode decodificar.
- **Não** recodifica no servidor. Zero ffmpeg, zero egress de vídeo pela nossa infra.
- **Não** regrava o modo player. Os dois modos coexistem; transmissão não substitui o player
  para quem não está transmitindo.
- **Não** grava. Nenhuma trilha é persistida. A transmissão existe enquanto o host segura.
- **Não** é implementação em mesh. Um SFU gerenciado (ver seção 7).

## 4. Termos

| Termo | Significado |
|---|---|
| **Modo player** | O modo atual da spec 11: iframe/`<video>` na sala, sincronizado por `storage.player` + broadcast. |
| **Modo transmissão** | O host captura uma aba com `getDisplayMedia` e publica a track num SFU. A sala exibe a track. O sync layer não participa. |
| **Transmissor** | No máximo uma pessoa por sala. É quem detém a `MediaStream`. |
| **Espectador** | Qualquer outro na sala. Não tem controles de player no modo transmissão. |

## 5. Requisitos funcionais

### Estado

- **FR-001** QUANDO não houver transmissão, ENTÃO `storage.broadcast` DEVE ser `null`.
- **FR-002** QUANDO alguém iniciar, ENTÃO `storage.broadcast` DEVE ser
  `{ broadcasterId, broadcasterName, startedAt }`, com `broadcasterId` igual ao `userId` do
  transmissor.
- **FR-003** QUANDO o transmissor parar, desconectar ou a track terminar, ENTÃO `storage.broadcast`
  DEVE voltar a `null`.
- **FR-004** QUANDO `storage.broadcast` não for `null`, ENTÃO a área de vídeo da sala DEVE
  mostrar a track e NÃO DEVE montar `PlayerShell` nem `PlayerControls`.
- **FR-005** QUANDO `storage.broadcast` for `null`, ENTÃO a área de vídeo DEVE voltar a exibir o
  estado de player normal (vídeo carregado, ou o estado "nenhum vídeo carregado").

### Iniciar

- **FR-006** QUANDO o transmissor acionar "iniciar transmissão", ENTÃO o cliente DEVE chamar
  `getDisplayMedia({ video: true, audio: true })` e, se a sala tiver `videoSourceUrl`, DEVE antes
  abrir essa URL em uma nova aba (`window.open(url, "_blank", "noopener")`).
- **FR-025** QUANDO o `getDisplayMedia` for invocado, ENTÃO as constraints DEVE incluir
  `selfBrowserSurface: "exclude"`, `systemAudio: "include"` e `surfaceSwitching: "include"`.
  Cada uma fecha um modo de falha que só aparece com duas pessoas reais na sala:
  **FR-025a** `selfBrowserSurface: "exclude"` impede o salão de mirror — sem ele o seletor
  oferece a aba da própria sala, e quem compartilha a sala transmite a sala recursivamente;
  **FR-025b** `systemAudio: "include"` é o que faz a caixa de áudio aparecer no seletor, sem a
  qual "screen share com som" não existe; **FR-025c** `surfaceSwitching: "include"` deixa o host
  trocar a aba compartilhada pela UI do Chrome sem derrubar a transmissão.
- **FR-007** QUANDO a permissão for concedida, ENTÃO o cliente DEVE publicar a track de vídeo via
  `useLocalParticipant().setScreenShareEnabled(true)` e gravar `storage.broadcast` (FR-002).
- **FR-008** QUANDO a permissão for negada ou o usuário cancelar o seletor, ENTÃO
  `storage.broadcast` NÃO DEVE ser gravado e a UI DEVE voltar ao estado anterior sem erro fatal.
- **FR-009** QUANDO já existir um transmissor e o usuário não for ele, ENTÃO o botão DEVE estar
  desabilitado e o `aria-label` DEVE dizer que já há alguém transmitindo.
- **FR-010** QUANDO o browser não suportar `getDisplayMedia` (Safari), ENTÃO o botão NÃO DEVE ser
  renderizado.

### Receber

- **FR-011** QUANDO houver transmissão, ENTÃO o espectador DEVE assinar
  `Track.Source.ScreenShare` (vídeo) e `Track.Source.ScreenShareAudio` (áudio) e anexar cada
  `MediaStreamTrack` ao seu elemento `<video>`/`<audio>`.
- **FR-012** QUANDO a track de vídeo chegar, ENTÃO o `<video>` DEVE tocar com `playsInline` e
  `autoPlay` e `muted` — o áudio vem pela track separada, não pelo elemento de vídeo.
- **FR-013** QUANDO a track de áudio NÃO chegar (Firefox), ENTÃO o vídeo DEVE continuar
  tocando e a UI DEVE indicar que não há áudio, sem tratar como erro.
- **FR-014** QUANDO alguém entrar na sala já com transmissão ativa, ENTÃO DEVE ver a track sem
  precisar esperar evento — o estado vem de `storage.broadcast`, e a track do LiveKit é
  renegociada pela conexão.

### Áudio

- **FR-015** QUANDO o host capturar áudio, ENTÃO o áudio DEVE ser o da aba compartilhada.
- **FR-016** QUANDO o áudio não puder ser capturado, ENTÃO o app DEVE seguir com vídeo apenas e
  DEVE exibir um aviso explícito, nunca silêncio inexplicado.
- **FR-029** QUANDO quem está assistindo for o próprio transmissor, ENTÃO a sala NÃO DEVE
  tocar a track de áudio devolvida pelo SFU.
- **FR-030** QUANDO a track de áudio for a do próprio transmissor, ENTÃO a decisão DEVE ser
  tomada por `participant.isLocal` da própria track — não por comparar `identity` com o
  `userId`, e não por "sou participante local", que todo espectador também é.
- **FR-031** QUANDO a track de áudio existir e for do próprio transmissor, ENTÃO a sala NÃO
  DEVE exibir aviso de áudio ausente: nada quebrou, e afirmar que quebrou é pior que a
  omissão. Nenhum aviso substitui este silêncio — o transmissor ouve o som na aba, e a sala
  não precisa explicar isso para ele.
- **FR-026** QUANDO houver transmissão e a track de vídeo NÃO tiver chegado, ENTÃO a sala DEVE
  esperar por prazo limitado antes de concluir que nada vem, e ao vencê-lo DEVE dizer que a
  transmissão não chegou e oferecer saída manual para o modo player.
- **FR-027** QUANDO um espectador usar a saída de FR-026, ENTÃO o armazenamento DEVE continuar
  declarando a transmissão — a decisão é local de quem assiste e NÃO encerra a transmissão de
  quem transmite.
- **FR-028** QUANDO uma transmissão terminar e outra começar, ENTÃO a espera de FR-026 DEVE
  recomeçar do zero, inclusive quando o transmissor é o mesmo.

### Encerramento

- **FR-017** QUANDO o transmissor clicar em "parar transmissão", ENTÃO a track DEVE ser desligada
  e `storage.broadcast` DEVE ser zerado.
- **FR-018** QUANDO a track do transmissor terminar por qualquer motivo (revogação de permissão
  pelo SO, fim da aba compartilhada, `track.onended`), ENTÃO o estado DEVE ser limpo pelo
  caminho normal.
- **FR-019** QUANDO o transmissor sair da sala, ENTÃO `storage.broadcast` DEVE ser zerado e os
  espectadores DEVE ver o estado de player normal, não um player vazio.

### Saúde do SFU e honestidade do erro

> Estas FRs nasceram de uma falha em produção, não de um requisito teórico. O que
> aconteceu: a captura foi concedida pelo SO, a publicação falhou porque a room do
> Livekit não existia (credencial nunca chegou), e um `catch` genérico acusou o
> usuário de ter cancelado. O usuário ficou com o banner de "compartilhando"
> ligado, a tela indo para o SO, ninguém recebendo, e nenhuma pista do motivo.

- **FR-032** QUANDO o estado da conexão com o SFU não for "conectado", ENTÃO o botão de
  iniciar DEVE estar desabilitado, com o motivo nomeado no texto visível e no
  `aria-label`.
- **FR-033** QUANDO o botão for acionado com o SFU indisponível, ENTÃO o cliente NÃO DEVE chamar
  `getDisplayMedia`. Pedir captura ao SO sem poder publicar é o que produz a tela
  compartilhada sem ninguém recebendo.
- **FR-034** QUANDO a captura for recusada pelo usuário, ENTÃO a UI DEVE dizer que foi
  cancelada ou negada, e NÃO DEVE tentar desligar captura — nada foi capturado.
- **FR-035** QUANDO a captura for concedida mas a publicação falhar, ENTÃO o cliente DEVE
  desligar a captura antes de reportar, e o aviso DEVE atribuir a falha à publicação
  (e ao deploy), nunca ao usuário.
- **FR-036** QUANDO a credencial não puder ser obtida, ENTÃO a sala DEVE exibir a causa
  distinguível por status HTTP — 503 configuração, 403 permissão na sala, 401 sessão —
  em vez de degradar em silêncio para um botão que falha no clique.
- **FR-037** QUANDO a conexão WebSocket com o SFU falhar, ENTÃO a sala DEVE exibir o status
  HTTP do handshake e a razão do Livekit (`NotAllowed`, `ServerUnreachable`,
  `InternalError`), junto do texto do servidor.
- **FR-038** QUANDO o handshake responder 401, ENTÃO a sala DEVE apontar que `LIVEKIT_URL` e
  as chaves precisam ser do mesmo projeto — a falha mais provável e a que mais custou
  tempo de diagnóstico, porque a assinatura do token passa (200 na rota) e só o handshake
  rejeita.
- **FR-039** QUANDO o texto do servidor nomear um problema de credencial, ENTÃO essa
  leitura DEVE prevalecer sobre o `reason` do enum. O enum classifica "invalid token" como
  `ServerUnreachable` (a conexão de sinal não subiu), e a dica resultante — "confira o
  `LIVEKIT_URL`" — seria errada: o servidor respondeu, só recusou a credencial.
- **FR-040** QUANDO o host iniciar a transmissão, ENTÃO o preset DEVE ser o da qualidade
  escolhida pelo host, e o padrão DEVE ser 720p a 30fps — não o `h1080fps30` que o
  Livekit aplica quando `resolution` não vem explícito.
- **FR-041** QUANDO o host iniciar a transmissão, ENTÃO `contentHint` DEVE ser `motion`.
  `detail` troca taxa de quadros por nitidez e foi feito para texto; em vídeo é a causa
  de "transmissão travada".
- **FR-042** QUANDO o host mudar a qualidade durante a transmissão, ENTÃO o seletor DEVE
  estar desabilitado com o motivo nomeado, e a escolha DEVE valer para a próxima
  transmissão. Republicar derrubaria a transmissão em andamento.
- **FR-043** QUANDO houver status HTTP, ENTÃO ele DEVE ser exibido como fato observável,
  separado da dica. A dica é hipótese com ação; o status é o que o servidor respondeu.
  Fundir os dois faria a dica afirmar um status que não houve.

### Sessão

- **FR-020** QUANDO o cliente pedir credencial, ENTÃO o servidor DEVE emitir um token de room
  nomeado com o código da sala, com permissão de publicar e assinar.
- **FR-021** QUANDO o solicitante não tiver sessão, ENTÃO DEVE responder 401.
- **FR-022** QUANDO o solicitante não for membro da sala, ENTÃO DEVE responder 403.
- **FR-023** QUANDO a room não existir no banco, ENTÃO DEVE responder 404.
- **FR-024** A rota de credencial DEVE ser verificável por teste unitário, como
  `app/api/liveblocks-auth/route.ts` é.

## 6. Critérios de aceite

- **AC-001** Dado `storage.broadcast === null`, quando a sala renderiza, então existe um `<video>`
  do player normal e nenhum elemento de transmissão.
- **AC-002** Dado `storage.broadcast` preenchido, quando a sala renderiza, então existe um
  `<video>` ligado à track e NÃO existe o botão de play/pause de `PlayerControls`.
- **AC-003** Dado que o transmissor está transmitindo, quando ele fecha a aba da sala, então
  `storage.broadcast` fica `null` para os demais.
- **AC-004** Dado que já existe transmissor, quando outro usuário vê o botão, então ele está
  desabilitado e o texto diz que há transmissão em curso.
- **AC-005** Dado um ambiente sem `getDisplayMedia`, quando a sala renderiza, então o botão de
  iniciar transmissão não existe.
- **AC-006** Dado que só a track de vídeo chegou, quando o espectador olha, então o vídeo toca e
  há aviso de áudio ausente.
- **AC-007** Dado que a credencial é pedida sem sessão, quando a rota responde, então o status é
  401 e nenhum token é emitido.
- **AC-008** Dado que a credencial é pedida por não-membro, quando a rota responde, então o status
  é 403.
- **AC-009** Dado o parser de `storage.broadcast`, quando o valor for malformado, então o
  fallback é tratar como `null` e seguir no modo player.
- **AC-010** Dado que o áudio não foi capturado, quando o host inicia, então a transmissão
  acontece em vídeo apenas e nenhum erro aparece para os espectadores.
- **AC-011** Dado que o host iniciou a transmissão, quando a captura é pedida, então
  `setScreenShareEnabled` recebe `selfBrowserSurface: "exclude"` e `systemAudio: "include"`.
- **AC-012** Dado que há transmissão e nenhum quadro chegou, quando o prazo vence, então a tela
  diz "a transmissão não chegou" e oferece "voltar ao player".
- **AC-013** Dado que um espectador voltou ao player, quando a transmissão continua, então o
  armazenamento de `broadcast` não foi alterado.
- **AC-014** Dado que a credencial não chegou (503), quando a sala renderiza, então o botão
  está desabilitado e o texto diz que a transmissão não está configurada no deploy.
- **AC-015** Dado que o SFU está indisponível, quando o botão é acionado, então
  `setScreenShareEnabled` não é chamado e o storage não é tocado.
- **AC-016** Dado que a publicação falhou depois da captura concedida, quando o erro sobe,
  então `setScreenShareEnabled(false)` é chamado e o aviso aponta o servidor, com a
  menção de que o usuário não cancelou.
- **AC-017** Dado que o seletor foi dispensado, quando o erro sobe, então o aviso diz
  "cancelada ou negada" e nenhuma tentativa de desligar captura é feita.
- **AC-018** Dado que o handshake volta 401, quando a sala renderiza, então a mensagem diz
  que URL e chaves devem ser do mesmo projeto.
- **AC-019** Dado que a conexão está no ar, quando houve falha antes, então o motivo da
  falha não aparece mais na tela.
- **AC-020** Dado que quem assiste é o transmissor, quando a track de áudio é a dele, então
  nenhum elemento de áudio recebe a track.
- **AC-021** Dado que quem assiste é um espectador, quando a track de áudio é remota, então
  ela é anexada ao elemento de áudio.
- **AC-022** Dado que quem assiste é o transmissor, quando a track de áudio existe, então a
  sala não mostra aviso de áudio ausente.
- **AC-023** Dado que o host iniciou a transmissão, quando a captura é pedida, então
  `contentHint` é `motion` e `resolution` é o preset 720p30.
- **AC-024** Dado que o host escolheu qualidade alta, quando inicia a transmissão, então
  `resolution` é o preset 1080p30.
- **AC-025** Dado que a transmissão está em andamento, quando a sala renderiza, então o
  seletor de qualidade está desabilitado e o motivo está no nome acessível.
- **AC-026** Dado que o localStorage tem um valor que não é um nível válido, quando o host
  inicia a transmissão, então vale o padrão.

## 7. Decisões de arquitetura

### O motivo da falha de conexão

`RoomEvent.ConnectionStateChanged` emite **só** o estado, sem motivo. O resultado era uma sala
dizendo "sem conexão com o servidor de transmissão", que é a ausência de informação
apresentada como se fosse informação.

O `LiveKitRoom` tem `onError`, que recebe um `ConnectionError` com `.status` (o HTTP do
handshake) e `.reasonName`. É o bastante, e é a via óbvia.

**Duas armadilhas nesse caminho, ambas pagas aqui:**

1. `setLogExtension` do `livekit-client` resolveria o diagnóstico e **não é exportada** —
   existe no bundle, é API privada, e um guard silencioso esconderia que ela não chegou ao
   runtime. Diagnosticar com API privada é como a feature nasce quebrada sem ninguém
   perceber.
2. **Conectar por conta própria não funciona.** Uma versão anterior punha `connect={false}` e
   chamava `room.connect()` de um componente filho. O efeito do `LiveKitRoom` tem um `else`
   que chama `room.disconnect()` quando `connect` é falso, e efeito de pai roda **depois**
   do do filho: o filho abria a conexão e o pai a derrubava em seguida, com `Cancelled: Client
   initiated disconnect`. Pior que não diagnosticar — substituía uma falha real por uma
  .Connection que nunca subia, e ela parecia um sintoma do ambiente.

O `.status` é o que fecha o caso que mais custou tempo: a rota de token responde 200 porque
assinaram com as chaves coladas, e só o handshake revela que elas não são do projeto que
respondeu. Um 401 na tela é a diferença entre "URL errada" e "chave de outro projeto".

### Por que LiveKit Cloud

O modo transmissão exige SFU. A alternativa sem dependência — WebRTC mesh com signalização pelo
Liveblocks que já existe — é O(N²): o host sustenta uma saída por espectador, e o ICE/TURN/
renegociação de codec/reconexão é trabalho sutil que não pertence a este produto. LiveKit tem
screen share e áudio como primeira classe, free tier de 50k min/mês, e é self-hostável depois.

Dependências aprovadas, e **somente** estas três:

| Pacote | Papel |
|---|---|
| `@livekit/components-react` | `LiveKitRoom`, `useTracks`, `useLocalParticipant` |
| `livekit-client` | cliente WebRTC |
| `livekit-server-sdk` | mintar o token no servidor |

`@livekit/components-styles` NÃO entra: as tracks são anexadas direto a `<video>`/`<audio>` por
ref, o que evita um quarto pacote e CSS de terceiros.

### Onde mora o estado

O estado de transmissão vive no **storage do Liveblocks**, não nos data channels do LiveKit e não
em memória. Motivo: o app já tem storage por sala, ele já é reconciliado e já chega para quem
entra depois. Data channel seria uma segunda fonte de verdade para o mesmo fato, e o storage já
resolve o caso de late join que era o motivo de eu considerar data channel.

### LiveKit sempre conectado

A sala é envolvida por `LivekitRoom` sempre, não só quando há transmissão. Abrir a conexão custa um
WebSocket e dá início instantâneo quando alguém quiser transmitir, além de permitir exibir o
estado da conexão. Abrir sob demanda exigiria uma rodada extra de token + negotiate antes de
qualquer preview.

### O vídeo do host não está na sala

Esta é a consequência de projetada do requisito "voltar pra sala enquanto o vídeo rola em outra
aba". O host compartilha uma aba **separada**. Por isso FR-006 abre a URL em nova aba antes de
pedir a permissão: o seletor do sistema precisa ter o que escolher.

### Qualidade: escolha do host, local a ele

O uplink do host é o recurso escasso, e a qualidade não é propriedade da sala.
Colocar a escolha no storage do Liveblocks daria a qualquer membro o direito de
degradar a transmissão dos outros — a mesma classe de griefing que a spec já
documenta para `storage.broadcast`. Por isso a preferência é local e persistente
(`localStorage`), seguindo o mesmo mecanismo de `useVideoQuality`.

| nível | preset | banda | quando |
|---|---|---|---|
| baixa | `h720fps15` | 1,5 Mbps | uplink fraco |
| normal | `h720fps30` | 2 Mbps | padrão |
| alta | `h1080fps30` | 5 Mbps | uplink folgado |

O padrão é **normal** e não o `h1080fps30` que o Livekit usa quando `resolution`
não vem explícito: 5 Mbps de upstream é o suficiente para frames descartados, que
aparecem como travamento. 720p a 30fps custa 40% da banda com a **mesma taxa de
quadros**, e é o que resolve "travado" — travamento é falta de quadros, não falta
de pixels.

`contentHint` é `motion` e **não** é uma opção. Pela spec WebRTC, `detail` manda
o encoder preservar detalhe ao custo da taxa de quadros, e foi feito para texto e
arte vetorial. Para vídeo é o oposto do que serve, e foi o que fez a primeira
transmissão parecer travada: o encoder segurava nitidez e descartava quadros. O
próprio Livekit força `motion` em screen share porque o caminho `detail` é
"untested/buggy".

A troca só vale para a próxima transmissão: a track já foi criada com o preset
escolhido e mudá-lo exigiria republicar, o que derrubaria a transmissão no meio do
filme. Por isso o seletor fica visível mas desabilitado durante a transmissão.

### Compartilhar ABA, nunca a tela inteira

Uma versão anterior desta spec aceitava, como limitação, que "aba em segundo plano pode ter a taxa
de captura reduzida" e oferecia como fallback o usuário compartilhar a tela inteira. **Era advice
invertido**, e removê-lo é correção de requisito, não ajuste de texto.

O Chrome documenta o contrário para captura de aba: a aba segue sendo compartilhada mesmo quando o
usuário interage com outro aplicativo, e a captura de aba entrega taxa de quadros **mais estável**
que a de tela ou janela. O requisito do usuário — voltar para a sala e conversar enquanto o vídeo
rola em outra aba — é exatamente o caso que a captura de aba cobre melhor.

E o fallback que a spec sugeria era ativamente danoso: compartilhar a tela inteira inclui a aba da
sala no quadro, o que produz (a) o salão de mirror, com a sala se reproduzindo a cada geração e o
atraso do SFU acumulando, (b) vazamento do chat e da lista de quem está na sala para todos os
espectadores, e (c) pior taxa de quadros, que é o oposto do que se queria.

Por isso a implementação **exclui a própria aba do seletor**: `selfBrowserSurface: "exclude"`
(FR-025). Sem isso o usuário pode escolher exatamente o que a spec mandava evitar.

## 8. Fora do escopo desta spec

- **Voice chat de participantes.** Decidido contra na triagem: exige `getUserMedia` por
  participante, UI de mute, indicador de fala e tratamento de eco (o áudio da transmissão voltaria
  pelo mesmo alto-falante). O chat de texto existente cobre a conversa.
- **Trocar de transmissão em andamento.** Se o host parar, a sala volta ao modo player. Não há
  transferência de papel.
- **Seleção de aba pelo site.** O seletor é o do sistema operacional. Construir um seletor próprio
  exigiria `getDisplayMedia` sem escolha, que o browser não oferece.
- **Android/iOS.** `getDisplayMedia` não existe em iOS Safari. A feature é de desktop; o botão
  some nos outros casos, sem tratamento especial por plataforma.

## 9. O que esta spec custa no payload

Medido no build de produção depois da implementação:

| | gzip |
|---|---|
| `/rooms/[code]` antes (spec 11) | 107,6 KB |
| `/rooms/[code]` depois | 260,1 KB |
| `livekit-client` sozinho, sem tree-shaking | 297,0 KB |

**O NFR-001 da spec 11 (≤120 KB gzip) foi estourado por esta spec.** É um custo
inerente: um cliente de SFU é WebRTC, ICE, DTLS, SCTP, codecs e um state machine de
sincronização — não há versão dele que caiba em few KB. A questão não é se o peso
existe, e sim onde ele fica.

Tentado e **rejeitado**: isolar o `LiveKitRoom` atrás de `next/dynamic`. Não rende
nada, porque o LiveKit entra na sala por `RoomExperience` → `BroadcastControls` e
`ScreenSharePlayer`, e não pelo wrapper. Para tirá-lo do payload inicial seria
preciso (a) tornar os dois componentes de sala dinâmicos E (b) montar o
`LiveKitRoom` só em volta do pedaço que os contém — o que atrasa o botão de
transmitir até o chunk chegar, entregando um botão que não funciona nos primeiros
segundos. Preço ruim para quem é o principal usuário da feature.

Se o custo for inaceitável no mobile, a saída com melhor relação é o **dois
cliques**: o botão da sala é leve e próprio, e o primeiro clique baixa o chunk do
Livekit e conecta, o segundo abre o seletor. Não está implementado — é decisão de
produto, não de engenharia.

O que mitigou: `/login`, `/register`, `/rooms` e `/` **não** pagam nada disso. O
peso está confinado à rota da sala, e apenas quando `LIVEKIT_URL` está
configurado — sem o SFU no deploy, o wrapper não é montado e o chunk nunca entra
no grafo.

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Erro de configuração se apresenta como erro do usuário | Impedido por FR-034/FR-035: `NotAllowedError` é a fronteira entre cancelamento e falha de publicação, e o aviso de falha nomeia o deploy. A credencial indisponível aparece na tela com o status HTTP (FR-033), então o problema é diagnosticável sem DevTools. |
| Captura órfã: SO continua capturando com ninguém recebendo | Impedido por prevenção (FR-033: não pedir captura sem SFU conectado) e por cura (FR-035: desligar o que o SO já concedeu). A primeira tentativa em produção produziu exatamente este estado. |
| Dependência de terceiro para mídia central do produto | LiveKit é o SDK de referência do WebRTC, tem free tier, e é self-hostável. O estado de transmissão **não** depende dele — se o LiveKit cair, a sala volta ao modo player com o storage intacto. |
| Payload da sala subiu de 107,6 para 260,1 KB gzip | Ver seção 9: inerente ao SFU, medido, e as demais rotas não pagam. A mitigação possível (dois cliques) está descrita e não foi implementada por decisão de produto. |
| Qualquer membro pode escrever `storage.broadcast` e tirar o player da tela de todos por até 3 min | É a mesma classe de confiança do storage do Liveblocks que o app já tem: `storage.player` e o `ts` dos eventos têm o mesmo dono. O estado é validado por forma, mas a **autoria** não é verificada pelo servidor. Um membro malicioso escreve `{ broadcasterId, broadcasterName, startedAt, heartbeatAt }` sem ter track nenhuma, e a sala mostra "conectando à transmissão" até o prazo vencer. **Parcialmente mitigado**: FR-026/FR-027 dão a quem assiste uma saída manual após 12s, então o espectador não fica preso — ele só precisa de um clique. **Autoria não resolvida**: fechar exige que o storage seja gravado por um caminho que o cliente não controle, que é mudança de arquitetura e não cabe nesta spec. |
| Escolher a aba da sala no seletor produz salão de mirror | Eliminado por `selfBrowserSurface: "exclude"` (FR-025a), coberto por AC-011. A constraint é do Chrome e o Livekit a repassa literal — não há tradução no meio que a possa perder. |
| Host compartilha a tela inteira em vez da aba | Eliminado pela mesma constraint, e era o advice que a versão anterior desta spec dava. Compartilhar a tela inclui o chat e a presença no quadro de todos os espectadores, além de salão de mirror e pior taxa de quadros. |
| `canPublish: true` para todo membro do Livekit, não só para o transmissor | O single-broadcaster é aplicado no cliente (`canStartBroadcast`), não no token. Um membro autenticado poderia publicar track pelo SFU diretamente, sem passar pelo botão. A sala não exibiria (o `broadcasterId` do storage não casaria), então o efeito é banda e CPU, não vídeo alheio na tela. Mitigação se importar: emitir token com `canPublish` condicionado a não haver transmissão ativa. |
| Vazamento de tela para além da intenção | O seletor é do SO e o browser mostra preview. O app nunca pede acesso sem `getDisplayMedia`. |
| Áudio ausente silenciosamente | FR-016 exige aviso explícito. Firefox é o caso conhecido. |
| Sala com transmissão e estado de player antigo simultâneos | FR-004/FR-005 tornam o storage de transmissão autoritativo sobre o que é exibido. Os dois coexistem no storage, o que é deliberado: encerrar a transmissão devolve a sala ao vídeo que já estava carregado. |
| Custos do LiveKit estourando o free tier | 50k min/mês. Uma sessão de 2h com 6 pessoas consome 12 min de participant-minutes. Margem grande para o uso esperado. |

## 11. Arquivos

| Papel | Arquivo |
|---|---|
| Estado da transmissão no storage | `liveblocks.config.ts` |
| Token no servidor | `lib/livekit.ts`, `app/api/livekit-auth/route.ts` |
| Wrapper `LiveKitRoom` | `components/room/LiveKitProvider.tsx` |
| UI de host (iniciar/parar) | `components/room/BroadcastControls.tsx` |
| UI de espectador (vídeo + áudio) | `components/room/ScreenSharePlayer.tsx` |
| Integração e gate do player | `components/room/RoomExperience.tsx` |
| Variáveis | `.env.example` |
