# Spec: code review — autorização, injeção de conteúdo e bugs funcionais

**Status:** implementado
**Pesquisa:** `research.md`

## 1. Problema / motivação

Revisão de código completa do projeto (não só o diff), depois do commit da rodada 2 de UI/UX. Em
duas passadas: a primeira encontrou seis defeitos — entre eles um bypass de autorização real e uma
injeção de conteúdo (`embedUrl`); a segunda conferiu que as correções não introduziram regressão e
encontrou três bugs novos, um deles regressão da própria correção do overlay de erro. Esta spec
documenta o contrato que as duas rodadas fecharam: todos os achados foram corrigidos.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Fechar o bypass de autorização em que um segmento de URL com `%`/`_` resolvia uma sala arbitrária
   e criava `RoomMember`.
2. Fechar a injeção de `embedUrl`, validando no servidor e de novo na renderização.
3. Manter o overlay de erro do player alcançável e desobstruído: aparecer quando há erro e sumir
   quando a reprodução volta.
4. Entregar o aviso "entrou na sala" e parar de sequestrar atalhos do navegador.
5. Cobrir com teste as categorias de risco que motivaram a revisão.

**Não-objetivos**

- Reescrever o mecanismo de sincronização de vídeo (`useYouTubeSync`, `useVimeoSync`,
  `useNativeVideoSync`).
- Fazer proxy ou scraping de terceiros: a resolução segue por sniff de extensão e oEmbed público.
- Auditar vetores além dos citados — o escopo é o que a revisão alcançou.
- Alterar o fluxo nativo de criação de sala (POST com redirect 303).
- Esconder o overlay de erro por CSS: a correção mantém o overlay vivo e zera o estado de erro no
  backend.

## 3. Histórias de usuário

- **US-1**: Como dono de sala, quero que ninguém entre na minha sala por uma URL manipulada.
- **US-2**: Como participante, quero que ninguém grave conteúdo injetado que apareça no player dos
  outros.
- **US-3**: Como usuário, quero ver o erro do player quando ele acontece e ele sumir quando o vídeo
  volta.
- **US-4**: Como usuário, quero que meus atalhos do navegador (Ctrl+F, Cmd+M) continuem funcionando
  dentro da sala.
- **US-5**: Como mantenedor, quero testes que cubram parsing de URL, aritmética de late-join e
  formato de código de convite.

## 4. Requisitos funcionais (EARS)

- **FR-001** O sistema DEVE resolver a sala por duas comparações de igualdade exata (`code` e
  `code.toUpperCase()`), sem `mode: "insensitive"`, de modo que `%` e `_` do segmento de URL não
  funcionem como curinga. (achado 1)
- **FR-002** SE o código não corresponder a nenhuma sala, ENTÃO o servidor NÃO DEVE criar
  `RoomMember` nem conceder acesso ao Liveblocks. (achado 1)
- **FR-003** O endpoint `PATCH /rooms/[code]/video` NÃO DEVE aceitar `source` nem `embedUrl` do
  client; DEVE aceitar apenas `sourceUrl` e re-derivar `source`/`embedUrl` no servidor por
  `resolveVideoUrl`. (achado 2a)
- **FR-004** SE a URL não passar pela checagem de protocolo `http(s)`, ENTÃO o sistema NÃO DEVE
  renderizá-la em `<iframe src>` nem em `<a href>`. (achado 2b)
- **FR-005** O overlay de erro do player DEVE renderizar enquanto `error` for não nulo, independente
  de `loading`. (achado 3)
- **FR-006** SE uma chamada de reprodução for rejeitada com `AbortError`, ENTÃO o sistema NÃO DEVE
  gravar mensagem de erro. (achado A)
- **FR-007** QUANDO a reprodução voltar a ocorrer (`onPlay`), o sistema DEVE zerar `error`.
  (achado A)
- **FR-008** SE o carregamento anterior não tiver concluído com sucesso ou estiver em erro, ENTÃO o
  sistema DEVE refazer o carregamento em vez de reutilizar o atalho. (achado B)
- **FR-009** QUANDO o aviso "entrou na sala" for emitido antes de o socket conectar, o sistema DEVE
  enfileirá-lo. (achado 4)
- **FR-010** SE uma tecla for pressionada com Ctrl, Cmd ou Alt, ENTÃO o handler de atalhos DEVE
  ignorá-la. (achado 5)
- **FR-011** QUANDO um seek local for aplicado no Vimeo, o sistema DEVE marcá-lo como remoto, para
  não emitir `commit`/`broadcast` em duplicidade. (achado C)
- **FR-012** O repositório DEVE ter runner de teste (`npm test`) com casos para parsing de URL de
  terceiro, o vetor de injeção, a aritmética de late-join/drift e o formato do código de convite.
  (achado 6)

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário. Cenários infelizes primeiro.

### Autorização

- **AC-001** [FR-001] Given o Postgres de dev com salas existentes, When `GET /rooms/%` é executado,
  Then nenhuma sala é resolvida.
- **AC-002** [FR-001] Given o mesmo banco, When `GET /rooms/A%` e `GET /rooms/_` são executados,
  Then nenhuma sala é resolvida.
- **AC-003** [FR-002] Given o usuário autenticado, When `GET /rooms/%`, Then nenhuma linha de
  `RoomMember` é criada e `/api/liveblocks-auth` não concede acesso.
- **AC-004** [FR-001] Given `Room.code = "ABCD2345"`, When `/rooms/abcd2345` ou `/rooms/ABCD2345` é
  aberto, Then a mesma sala é resolvida.

### Injeção de `embedUrl`

- **AC-005** [FR-003] Given `PATCH /rooms/[code]/video` com
  `{ source: "GENERIC_IFRAME", embedUrl: "data:text/html,<form>" }` e sem `sourceUrl`, Then a
  resposta não é `200` e nenhum `embedUrl` começando em `data:` é persistido.
- **AC-006** [FR-003] Given `PATCH` com `{ sourceUrl: "https://exemplo.com/v" }`, Then o `embedUrl`
  gravado é re-derivado no servidor.
- **AC-007** [FR-004] Given o storage do Liveblocks com `embedUrl = "data:text/html,<form>…"`
  escrito direto, When a sala renderiza, Then o `<iframe>` mostra "link inválido pra incorporação."
  e nenhum `<a href>` aponta para o valor `data:`.

### Overlay de erro

- **AC-008** [FR-005] Given `loading === false` e `error !== null`, When o player renderiza, Then o
  overlay de erro está presente no DOM.
- **AC-009** [FR-006] Given `play()` rejeitando com `AbortError` após um `pause()` remoto, When a
  rejeição é tratada, Then `error` permanece nulo.
- **AC-010** [FR-007] Given `error` não nulo e a reprodução voltando, When `onPlay` dispara, Then
  `error` é zerado e o overlay deixa o DOM.
- **AC-011** [FR-008] Given `isReady === false` e o mesmo link colado de novo, When o link é
  reenviado, Then o carregamento é refeito e a tentativa não é suprimida pelo erro anterior.

### Anúncio e atalhos

- **AC-012** [FR-009] Given o socket `connecting` no mount, When "entrou na sala" é emitido, Then o
  evento é enfileirado e entregue aos demais ao conectar.
- **AC-013** [FR-010] Given o foco fora de campo editável, When `Ctrl+F` é pressionado, Then o
  handler retorna sem `preventDefault()` e a busca do browser abre.
- **AC-014** [FR-010] Given o mesmo contexto, When `f` é pressionado sem modificador, Then a tela
  cheia é acionada.
- **AC-015** [FR-011] Given um arraste do scrubber no Vimeo, When o `seeked` dispara, Then apenas um
  `commit`/`broadcast` é emitido para o seek local.

### Testes

- **AC-016** [FR-012] Given `npm test`, Then o runner executa 22 testes e todos passam, cobrindo
  `lib/video-source.test.ts`, `hooks/playerController.test.ts` e `lib/room-code.test.ts`.

## 6. Requisitos não-funcionais (quantificados)

- **Autorização:** `%`, `A%` e `_` casam 0 salas (reverificado com query real contra o Postgres de
  dev) (AC-001, AC-002).
- **Entrega do anúncio de entrada:** de 0% para 100% dos mounts (AC-012).
- **Testes:** 22 testes em 3 arquivos, `npm test` 22/22; `npx tsc --noEmit` e `npx eslint` sem erro
  depois de cada rodada (AC-016).
- **Sincronização do Vimeo:** 1 `commit`/`broadcast` por seek local (antes, 2) (AC-015).

## 7. Dados e contratos

- `Room.code` continua `String @unique`; a resolução é igualdade exata (2 comparações por
  requisição).
- `PATCH /rooms/[code]/video` aceita `{ sourceUrl: string }`; erros são `{ error: string }` —
  `400` "link inválido." e `403` "não é membro desta sala.".
- `lib/video-source.ts` passa a expor `isSafeEmbedUrl(value: string): boolean`.
- Runner de teste: Vitest, exposto como `npm test` (dependência de dev adicionada por esta spec).

## 8. Riscos / dependências

- **Defesa em profundidade.** `isSafeEmbedUrl` cobre a escrita direta no storage do Liveblocks, que
  a validação server-side não alcança; ela não substitui `FR-003`.
- **Atalho de retry fora das dependências por design.** Em `hooks/useNativeVideoSync.ts`, `isReady`
  e `error` ficaram fora das dependências do efeito, com `eslint-disable-next-line` explicado —
  incluí-los faria o load bem-sucedido reentrar no atalho e reiniciar o vídeo.
- **Sem proxy/scraping.** `resolveVideoUrl` segue sem `HEAD` nem `Content-Type`; URL assinada sem
  extensão visível cai em `GENERIC_IFRAME` (limitação conhecida).
- **Dependência da spec 04.** O achado 3 corrige comportamento introduzido na spec 04, e a regressão
  (achado A) nasceu dessa correção.

## Anexo A — numeração legada (âncoras citadas pelo código)

Nenhuma âncora desta spec é citada pelo código: `grep -rn "05-code-review-seguranca" app components
hooks lib prisma` não retorna nenhum arquivo de código.

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| — | — | — | — |

**Observação.** As citações de código que *descrevem* o conteúdo desta spec o fazem apontando para
`docs/specs/04-auditoria-ui-ux-rodada-2/spec.md` (o detalhamento e o mapa de redirecionamento estão
no Anexo A da spec 04):

- `lib/rooms.ts:6` ↔ **achado 1** desta spec (`FR-001`, `FR-002`).
- `components/room/GenericIframe.tsx:10`, `lib/video-source.ts:123`,
  `app/rooms/[code]/video/route.ts:36` ↔ **achado 2** desta spec (`FR-003`, `FR-004`).
- `components/room/PlayerLoadStatus.tsx:32` ↔ **achado 3** desta spec (`FR-005`).
- `hooks/useRoomJoinAnnouncement.ts:18` ↔ **achado 4** desta spec (`FR-009`).
- `components/room/RoomExperience.tsx:268` ↔ **achado 5** desta spec (`FR-010`).

O achado 6 (testes) e os achados 12.2.A/B/C não são citados por âncora em nenhum arquivo.
