# Spec: Fundação do MVP

**Status:** implementado
**Pesquisa:** `research.md`

## 1. Problema / motivação

O produto é um site estilo Rave: alguém cola o link de um vídeo numa sala e o assiste junto com outras pessoas — player sincronizado entre participantes onde a fonte permitir (YouTube como caso principal, Vimeo e embeds genéricos como fontes adicionais) e chat ao vivo. Sem uma base fixada, cada feature seguinte (auth, sala, sync, chat, fontes, visual) ficaria construída sobre decisões implícitas e divergentes. Esta spec fixa essa base como contrato: modelo de dados, contratos de eventos em tempo real, rotas, autenticação, catálogo de fontes de vídeo com seus limites técnicos e direção visual.

## 2. Objetivos e não-objetivos

**Objetivos**
- Fixar o modelo de dados (Prisma/Postgres) e as regras de identidade de sala.
- Fixar os contratos de estado, eventos e presença do Liveblocks.
- Fixar o mapa de rotas (App Router) e a proteção de `/rooms/**`.
- Fixar o fluxo de autenticação (NextAuth Credentials) e a sessão JWT.
- Fixar o catálogo de fontes de vídeo e o limite de sync de cada uma.
- Fixar a direção visual monocromática e o piso de qualidade de UI.

**Não-objetivos (excluídos do MVP)**
- Sem OAuth: autenticação é exclusivamente Credentials (email + senha).
- Sem persistência de chat: não existe model `Message`; o histórico vive só durante a sessão ativa e é reconstituído a zero para quem entra depois.
- Sem expiração ou cleanup de sala: a sala permanece indefinidamente após todos saírem.
- Sem papel de "dono com controle exclusivo" de player: qualquer participante pode play/pause/seek.
- Sem `postMessage`/controle de sync para `GENERIC_IFRAME` (a janela cross-origin não expõe contrato).
- Sem curadoria de fontes: a responsabilidade por ter direito de uso/embedar o link colado é de quem cola.
- Sem proxy, redirect-following, scraping ou processamento de mídia de terceiro no servidor.
- Sem mute de presença (mutar indicando aos outros) — removido por não ser necessário ao MVP.
- Sem conexão de conta via provider externo e sem tabela `Session` no banco.

## 3. Histórias de usuário

- **US-1** — Como visitante, quero me cadastrar e entrar com email e senha, para ter uma identidade na sala.
- **US-2** — Como usuário autenticado, quero criar uma sala, para receber um código de convite.
- **US-3** — Como usuário autenticado, quero entrar numa sala por código, para assistir junto com quem já está lá.
- **US-4** — Como participante, quero colar um link de vídeo e ver todos recebendo o mesmo vídeo ao mesmo tempo.
- **US-5** — Como participante, quero dar play/pause/seek e ver o player dos outros acompanhar (quando a fonte permitir).
- **US-6** — Como participante, quero saber quando uma fonte não sincroniza play/pause, para não supor que o controle de alguém vale para os outros.
- **US-7** — Como participante, quero trocar mensagens ao vivo durante a sessão.
- **US-8** — Como participante, quero ver quem está na sala.
- **US-9** — Como participante, quero reabrir uma sala e reencontrar o último vídeo carregado.
- **US-10** — Como participante, quero controlar a reprodução por uma barra própria do app, não pelo chrome do backend.
- **US-11** — Como participante, quero entrar/sair da tela cheia e alternar o "modo teatro" com o chat ao lado.
- **US-12** — Como participante em celular, quero uma coluna única com o vídeo primeiro e o chat abaixo.

## 4. Requisitos funcionais (EARS)

### Dados e identidade de sala

- **FR-001** O sistema DEVE persistir, via Prisma no Postgres, os modelos `User` (`email` @unique, `passwordHash`, `name?`, `createdAt`), `Room` (`code` @unique e indexado, `name?`, `videoSourceUrl?`, `videoSource?`, `embedUrl?`, `ownerId`, `createdAt`, `updatedAt`) e `RoomMember` (`roomId`, `userId`, `joinedAt`, com @@unique[roomId, userId]), e DEVE tipar `videoSource` como o enum `VideoSource` = { `YOUTUBE`, `VIMEO`, `GENERIC_IFRAME` }.
- **FR-002** QUANDO criar uma sala, o sistema DEVE gravar em `Room.code` um código de 8 caracteres gerado por `lib/room-code.ts` (alfabeto sem `0`, `O`, `1`, `I`, `L` e `U`), e NÃO o `cuid` do schema; SE a gravação colidir (`P2002`), ENTÃO o sistema DEVE gerar novo código e repetir; após 5 tentativas, DEVE cair no `@default(cuid())` do schema.
- **FR-003** Salas criadas antes da mudança de código DEVEM manter o `cuid` de 25 caracteres e continuar válidas.
- **FR-004** QUANDO o usuário cria uma sala, o sistema DEVE responder com redirect HTTP **303** para `/rooms/[code]` (não o 307 default, que reenviaria o POST no destino).
- **FR-005** O sistema DEVE manter em `Room` o último vídeo carregado (`videoSourceUrl`/`videoSource`/`embedUrl`), para que reabrir a sala reencontre o vídeo anterior mesmo com o storage do Liveblocks efêmero entre sessões ativas.

### Contratos Liveblocks

- **FR-006** O sistema DEVE identificar cada Liveblocks Room pelo mesmo valor de `Room.code` do Postgres.
- **FR-007** O sistema DEVE manter o storage da sala tipado como `video { source: "YOUTUBE"|"VIMEO"|"GENERIC_IFRAME"|"DIRECT_MEDIA"|null, embedUrl: string|null, sourceUrl: string|null, loadedAt: number|null }` e `player { isPlaying: boolean, currentTime: number, updatedAt: number, lastActorId: string }`.
- **FR-008** O sistema DEVE emitir eventos de broadcast tipados: `LOAD_VIDEO { source, embedUrl, sourceUrl, actorId, ts }`, `PLAY { time, actorId, ts }`, `PAUSE { time, actorId, ts }`, `SEEK { time, actorId, ts }` e `CHAT_MESSAGE { id, authorId, authorName, text, ts }`.
- **FR-009** QUANDO um participante cola um link, o sistema DEVE escrever em `storage.video`, broadcastar `LOAD_VIDEO` e cada cliente DEVE recarregar seu player/iframe com o `embedUrl` recebido.
- **FR-010** QUANDO um participante dispara play/pause/seek, o sistema DEVE escrever em `storage.player` (fonte de verdade do sync) e broadcastar `PLAY`/`PAUSE`/`SEEK`; todo cliente DEVE aplicar a ação no player local.
- **FR-011** O sistema DEVE mudar `storage.video.loadedAt` a cada "carregar", inclusive para URL idêntica ao vídeo já carregado, e DEVE incluir `loadedAt` nas dependências do efeito que (re)cria o player.
- **FR-012** ENQUANTO `isPlaying`, cada cliente DEVE comparar a posição local (`getCurrentTime()`) com a esperada (`storage.player.currentTime + (Date.now() - storage.player.updatedAt)/1000`) a cada 3s; SE `|diff| > 1.5s`, ENTÃO o sistema DEVE aplicar `seekTo(esperado)` local, sem gerar novo broadcast; a correção DEVE rodar apenas quando `source` for `YOUTUBE` ou `VIMEO`.
- **FR-013** SE um snapshot de `storage.player` tiver mais de 300s (5 min), ENTÃO o sistema DEVE descartá-lo e limitar a posição calculada pela duração do vídeo.
- **FR-014** QUANDO `source` for `GENERIC_IFRAME`, `PLAY`/`PAUSE`/`SEEK` NÃO DEVEM ter efeito e a UI DEVE exibir o badge "sync limitado — controle manual" (com borda tracejada no anel de sync).
- **FR-015** O sistema DEVE expor `Presence` por conexão como `{ userId: string, name: string }`.
- **FR-016** O sistema DEVE entregar o chat exclusivamente por broadcast `CHAT_MESSAGE`; o histórico DEVE viver em estado React local (array em memória), reconstituído a zero para quem entra depois, e NÃO DEVE ser gravado em `Presence` nem em `Storage`.

### Rotas e autenticação

- **FR-017** O sistema DEVE expor as rotas: `/login`, `/register`, `/rooms` (menu: criar / entrar por código / suas salas por `RoomMember` / sair), `POST /rooms/new`, `/rooms/[code]` (+ `layout`, `loading`, `not-found`), `PATCH /rooms/[code]/video` (gated por `RoomMember`), `not-found` global, `error` global, `api/auth/[...nextauth]`, `POST /api/register`, `api/liveblocks-auth` e `POST /api/resolve-embed`.
- **FR-018** `proxy.ts` (raiz) DEVE proteger `/rooms/**` redirecionando o não-autenticado para `/login`.
- **FR-019** O sistema DEVE autenticar por `CredentialsProvider` único; em `authorize()`, DEVE normalizar o email recebido (`trim().toLowerCase()`) antes de buscar `User` e DEVE comparar a senha com `bcrypt.compare` contra `passwordHash`; DEVE usar estratégia de sessão `jwt` (sem tabela `Session`) e DEVE popular `session.user.id` a partir do `sub` do token.
- **FR-020** O sistema DEVE cadastrar em `POST /api/register` (form próprio, não rota do NextAuth) fazendo `bcrypt.hash` e `prisma.user.create`.
- **FR-021** O endpoint `api/liveblocks-auth` DEVE autorizar a conexão por sessão NextAuth + vínculo `RoomMember`, usando o secret key só no servidor.
- **FR-022** O `layout` de `/rooms/[code]` DEVE buscar a sala por `code` case-insensitive e garantir o `RoomMember` do usuário (upsert ao entrar); `not-found` DEVE cobrir sala inexistente.

### Fontes de vídeo e limites técnicos

- **FR-023** O sistema DEVE resolver a fonte no servidor (`POST /api/resolve-embed`), recebendo `{ url: string }` e devolvendo `{ source, embedUrl, sourceUrl }` ou erro, para evitar CORS na consulta de oEmbed e não deixar o client decidir sozinho que conteúdo remoto processar.
- **FR-024** QUANDO a URL casar com padrão do YouTube (`youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/`), o sistema DEVE extrair o `videoId`, definir `source: "YOUTUBE"` e montar `embedUrl = https://www.youtube.com/embed/{id}`.
- **FR-025** QUANDO a URL casar com padrão do Vimeo (`vimeo.com/{id}`), o sistema DEVE resolver via oEmbed público (`https://vimeo.com/api/oembed.json?url=...`), extrair o `videoId` do `iframe src` retornado e definir `source: "VIMEO"`.
- **FR-026** QUANDO a URL casar com padrão do Google Drive (`drive.google.com/file/d/{id}/view`, `/open?id={id}` ou `/preview`), o sistema DEVE extrair o `{id}` e montar `embedUrl = https://drive.google.com/file/d/{id}/preview` com `source: "GENERIC_IFRAME"` (Drive não expõe controle via `postMessage`).
- **FR-027** QUANDO o `pathname` da URL terminar em `.mp4`, `.webm` ou `.m3u8` (com ou sem query string), o sistema DEVE definir `source: "DIRECT_MEDIA"` com `embedUrl` igual à própria URL.
- **FR-028** SE a URL não casar com nenhum padrão conhecido, ENTÃO o sistema DEVE tratá-la como `GENERIC_IFRAME`, usando a própria URL colada como `iframe src`.
- **FR-029** O sistema DEVE validar formato no servidor (regex por domínio conhecido para YouTube/Vimeo; para o genérico, que seja uma URL bem formada com protocolo `https`) e NÃO DEVE seguir redirects nem baixar/executar HTML de terceiros.
- **FR-030** O sistema DEVE renderizar o `iframe` genérico com `sandbox="allow-scripts allow-same-origin allow-presentation"`, sem `allow-top-navigation` e sem `allow-popups`; SE o embed for bloqueado por `X-Frame-Options`/`Content-Security-Policy: frame-ancestors`, ENTÃO o sistema DEVE exibir estado de erro visível ("este link não permite ser incorporado").
- **FR-031** O sistema DEVE tocar `DIRECT_MEDIA` num `<video>` próprio — `.mp4`/`.webm` direto e `.m3u8` via `hls.js` em browsers com MSE, ou `video.src` nativo no Safari (HLS nativo) —, sem `HEAD`/checagem de `Content-Type` (sniff de extensão apenas).
- **FR-032** SE o script da IFrame API do YouTube falhar (`onerror`) ou exceder timeout de 10s, ENTÃO o sistema DEVE rejeitar o `Promise` singleton de `loadYouTubeIframeApi()` e resetá-lo para `null`, permitindo nova tentativa sem reload de página.
- **FR-033** O sistema DEVE destruir e zerar a ref do player assim que `video.source` deixar de ser a fonte daquele hook, para um load futuro construir um player novo contra o container atual.
- **FR-034** O sistema DEVE tratar `onError` 100/101/150 do YouTube e `error` do Vimeo Player SDK, expondo mensagem específica via `PlayerLoadStatus` (além do timeout genérico).
- **FR-035** O sistema DEVE expor de cada hook de sync (YouTube/Vimeo/nativo) um `controller: PlaybackController` = `{ isReady, isPlaying, currentTime, duration, volume, isMuted, error, play, pause, togglePlay, seek, setVolume, toggleMute }`; `volume`/`isMuted` DEVEM ser sempre locais, nunca sincronizados.
- **FR-036** O sistema DEVE esconder o chrome nativo em `YOUTUBE`/`VIMEO`/`DIRECT_MEDIA` (YouTube `playerVars: { controls: 0, disablekb: 1 }`; Vimeo `controls: false`) e renderizar barra própria (`PlayerControls`) como overlay.
- **FR-037** O sistema DEVE montar uma camada de captura de ponteiro (`div absolute inset-0 z-10` transparente) sobre o player sempre que houver `PlaybackController`; ela NÃO DEVE ser montada em `GENERIC_IFRAME`.
- **FR-038** O alvo de `requestFullscreen()` DEVE ser o container que envolve **vídeo e aside** (o `stageRef`), não apenas o vídeo.
- **FR-039** QUANDO o YouTube estiver `isReady` e pausado, o sistema DEVE cobrir o `iframe` com um `div` opaco (`bg-[var(--bg-void)]`) e um botão de play centralizado.
- **FR-040** `seek()` DEVE broadcastar explicitamente em todo backend; `play()`/`pause()` NÃO DEVEM broadcastar por conta própria (os listeners de estado de cada SDK já o fazem).

### Ambiente, serviços e direção visual

- **FR-041** O sistema DEVE exigir, em produção, as variáveis `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` e `LIVEBLOCKS_SECRET_KEY` (uso só no endpoint de auth), tratando `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` como opcional.
- **FR-042** O sistema NÃO DEVE esconder a badge "Powered by Liveblocks" (exigência do plano Free) e DEVE usar `badgeLocation="bottom-left"` apenas para reposicioná-la.
- **FR-043** O sistema DEVE usar paleta monocromática dark-first com os tokens `--bg-void #0A0A0A`, `--bg-surface #141414`, `--line #2A2A2A`, `--ink #F2F2F2`, `--ink-muted #7A7A7A`, `--invert-bg #FFFFFF`, `--invert-fg #000000` e `--outline-strong #FFFFFF`.
- **FR-044** O sistema DEVE sinalizar estado por contraste, inversão ou peso, nunca por matiz: CTA primário = bloco invertido (`--invert-bg`/`--invert-fg`); foco = anel duplo em `--outline-strong` com `ring-offset` em `--bg-void`; erro = bloco com borda em `--ink` + texto em negrito; link = `--ink` com sublinhado sempre visível; presença ativa = ponto sólido em `--ink`.
- **FR-045** O sistema DEVE usar três papéis tipográficos: Display (grotesk geométrico, tracking apertado, só em título de sala/estados vazios), Corpo (sans humanista, ~90% da UI) e Utilitária (mono, para código da sala, timestamp do chat e diagnóstico de sync).
- **FR-046** O sistema DEVE aplicar o anel de sync com três tratamentos estruturais: borda sólida `--line` (idle), borda sólida `--outline-strong` com pulso (`isPlaying`) e borda tracejada `--line` (`GENERIC_IFRAME`); a cada evento `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK` recebido, DEVE emitir um flash breve.
- **FR-047** Em desktop (`lg`), o layout DEVE ser ~80% vídeo / ~20% chat+presença (`lg:basis-[80%]`/`lg:basis-[20%]`), com `+` no cabeçalho de presença abrindo o modal de carregar link (não um form fixo abaixo do vídeo).
- **FR-048** Em tela cheia, o vídeo DEVE ocupar 100% por padrão; um botão (`TheaterIcon`, só visível em fullscreen) DEVE alternar o "modo teatro" (~80% de vídeo + chat/presença à direita, dentro da própria tela cheia), resetando para vídeo-só ao sair.
- **FR-049** Abaixo de `lg`, o layout DEVE ser coluna única, com o vídeo primeiro e chat/presença abaixo; a página DEVE ser uma casca de altura fixa (`h-dvh`, `overflow-hidden`) com a caixa do vídeo limitada a `38dvh` e o `aside` em `flex-1 min-h-0`, de modo que quem rola é o log do chat, não a página.
- **FR-050** Todo elemento interativo DEVE ter estado de foco visível (anel duplo em `--outline-strong`), inclusive em navegação por teclado.
- **FR-051** SE `prefers-reduced-motion` estiver ativo, ENTÃO o sistema DEVE desligar o pulso do anel de sync e qualquer transição não-essencial, restando só o flash instantâneo de estado.

## 5. Critérios de aceite (Given-When-Then)

- **AC-001** Dado um usuário autenticado no menu `/rooms`, quando ele cria uma sala, então recebe redirect 303 para `/rooms/[code]` e o `code` gravado tem exatamente 8 caracteres, sem `0`/`O`/`1`/`I`/`L`/`U`.
- **AC-002** Dado que o `code` gerado colide (erro `P2002`), quando o sistema tenta gravar, então gera um novo código e repete; após 5 tentativas, grava o `cuid` de 25 caracteres e a sala continua acessível.
- **AC-003** Dado um visitante não-autenticado, quando ele acessa `/rooms/<qualquer>`, então é redirecionado para `/login`.
- **AC-004** Dado um cadastro com email `A@B.com`, quando o login chega como `a@b.com` (autofill/caps), então o sistema autentica (email normalizado com `trim().toLowerCase()`); quando a senha está errada, então a resposta é "credenciais inválidas".
- **AC-005** Dado o link `não-é-uma-url`, quando `POST /api/resolve-embed` recebe `{ url }`, então devolve erro e o cliente não carrega player.
- **AC-006** Dado o link `https://youtu.be/abc123`, quando resolvido, então `source = "YOUTUBE"` e `embedUrl = https://www.youtube.com/embed/abc123`.
- **AC-007** Dado o link `https://vimeo.com/123456`, quando resolvido, então `source = "VIMEO"` e `embedUrl` é o `videoId` extraído do `iframe src` do oEmbed.
- **AC-008** Dado o link `https://drive.google.com/file/d/XYZ/view`, quando resolvido, então `embedUrl = https://drive.google.com/file/d/XYZ/preview` e `source = "GENERIC_IFRAME"`.
- **AC-009** Dado o link terminando em `.m3u8?token=...`, quando resolvido, então `source = "DIRECT_MEDIA"` e `embedUrl` é a própria URL.
- **AC-010** Dado um link `https://exemplo.com/player.html?x=1`, quando resolvido, então `source = "GENERIC_IFRAME"` e `embedUrl` é a própria URL (fallback universal).
- **AC-011** Dados dois participantes na mesma sala, quando um cola um link, então ambos recebem `LOAD_VIDEO`, o `storage.video` reflete `source`/`embedUrl`/`sourceUrl` e ambos carregam o mesmo `embedUrl`; o `loadedAt` muda mesmo quando a URL é idêntica à anterior.
- **AC-012** Dado `source = "YOUTUBE"` com dois participantes, quando um dá play, então `storage.player.isPlaying = true`, `updatedAt` é atualizado e o player do outro avança.
- **AC-013** Dado `source = "YOUTUBE"` tocando e um cliente 2,0s à frente do esperado, quando o tick de 3s roda, então o cliente aplica `seekTo(esperado)` local sem emitir novo broadcast; com o cliente 1,4s à frente, então nenhum seek é aplicado.
- **AC-014** Dado um snapshot de `storage.player` com `updatedAt` há 400s, quando o cliente calcula a posição esperada, então o snapshot é descartado e a posição é limitada pela duração do vídeo.
- **AC-015** Dado `source = "GENERIC_IFRAME"`, quando um participante dá play, então o outro participante não é afetado e aparece o badge "sync limitado — controle manual" com a borda tracejada.
- **AC-016** Dado que um participante entra depois de 20 mensagens enviadas, quando ele monta o chat, então sua lista começa vazia; quando alguém envia nova mensagem, então os conectados a recebem por broadcast, e nada de chat aparece em `Storage` ou `Presence`.
- **AC-017** Dado que já existe um vídeo carregado, quando o usuário reabre a sala, então `Room.videoSourceUrl`/`videoSource`/`embedUrl` ainda apontam para o último vídeo.
- **AC-018** Dado que o script da IFrame API falha (rede), quando `onerror` dispara ou passam 10s, então a promise é rejeitada e o singleton volta a `null`, e o próximo carregamento de vídeo YouTube funciona sem reload de página.
- **AC-019** Dado YouTube → Vimeo → YouTube em sequência (troca de fonte e volta), quando o YouTube recarrega, então o player é construído contra o `div` recém-montado (ref antiga destruída), com `onReady` disparando.
- **AC-020** Dado um link cujo embed é bloqueado por `X-Frame-Options`, quando a sala carrega, então o `iframe` fica em branco e a UI exibe "este link não permite ser incorporado" (não um bug silencioso).
- **AC-021** Dada a sala sem vídeo carregado, quando aberta, então `videoSourceUrl`/`videoSource`/`embedUrl` são nulos e o player mostra o placeholder "use carregar vídeo...", sem botão de tela cheia.

## 6. Requisitos não-funcionais (quantificados)

- **NFR-001** Contraste de `--ink` (#F2F2F2) sobre `--bg-void` (#0A0A0A) e sobre `--bg-surface` (#141414) ≥ 4,5:1 (AA) para texto de corpo.
- **NFR-002** Alvos de toque em mobile (chat, controles do player, entrar na sala) ≥ 44×44 px.
- **NFR-003** Correção de drift: tick a cada 3000 ms e limiar de 1,5 s.
- **NFR-004** Timeout de carga do script da IFrame API do YouTube: 10 s.
- **NFR-005** Snapshot de player considerado obsoleto (`STALE_SNAPSHOT_MS`): 300000 ms (5 min).
- **NFR-006** Código de sala: 8 caracteres; até 5 tentativas em colisão antes do fallback `cuid` (25 caracteres).
- **NFR-007** Caixa do vídeo em mobile limitada a 38dvh de altura.
- **NFR-008** Proporção desktop: ~80% vídeo / ~20% chat+presença; container entre `max-w-6xl` (antigo) e `max-w-[1800px]`.

## 7. Dados e contratos

**Modelo (Prisma).** `User { id, email @unique, passwordHash, name?, createdAt }`; `Room { id, code @unique @default(cuid()), name?, videoSourceUrl?, videoSource?, embedUrl?, ownerId, owner, createdAt, updatedAt, @@index([code]) }`; `RoomMember { id, roomId, userId, room, user, joinedAt, @@unique([roomId, userId]) }`; `enum VideoSource { YOUTUBE, VIMEO, GENERIC_IFRAME }`. O valor real de `code` é gerado em `lib/room-code.ts` (8 chars), não pelo `@default(cuid())`.

**Storage Liveblocks.**

```ts
type RoomStorage = {
  video: {
    source: "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME" | "DIRECT_MEDIA" | null;
    embedUrl: string | null;
    sourceUrl: string | null;
    loadedAt: number | null;   // epoch ms; muda a cada carregar, inclusive URL idêntica repetida
  };
  player: {
    isPlaying: boolean;
    currentTime: number;       // segundos, na última ação de controle
    updatedAt: number;         // epoch ms
    lastActorId: string;
  };
};
```

**Broadcast / Presence.**

```ts
type PlayerEvent =
  | { type: "LOAD_VIDEO"; source: "YOUTUBE"|"VIMEO"|"GENERIC_IFRAME"|"DIRECT_MEDIA"; embedUrl: string; sourceUrl: string; actorId: string; ts: number }
  | { type: "PLAY";  time: number; actorId: string; ts: number }
  | { type: "PAUSE"; time: number; actorId: string; ts: number }
  | { type: "SEEK";  time: number; actorId: string; ts: number };

type ChatEvent = { type: "CHAT_MESSAGE"; id: string; authorId: string; authorName: string; text: string; ts: number };

type Presence = { userId: string; name: string };
```

**Controlador de player.** `PlaybackController = { isReady, isPlaying, currentTime, duration, volume, isMuted, error, play, pause, togglePlay, seek, setVolume, toggleMute }`, implementado por `useYouTubeSync`/`useVimeoSync`/`useNativeVideoSync` e consumido por `PlayerControls`.

**Rota de resolução.** `POST /api/resolve-embed` recebe `{ url }` e devolve `{ source, embedUrl, sourceUrl }` ou erro.

## 8. Riscos / dependências

- **Dependências externas:** NextAuth (Credentials), bcrypt, Prisma/Postgres, Liveblocks, `hls.js` (MSE), `@vimeo/player`, YouTube IFrame API, oEmbed público do Vimeo e a badge obrigatória do plano Free do Liveblocks.
- **Fontes não sincronizáveis:** `GENERIC_IFRAME` (iframe cross-origin opaco) não expõe `postMessage` de controle — play/pause/seek não têm efeito; a UI precisa deixar isso explícito.
- **Embeds bloqueados:** sites podem recusar incorporação via `X-Frame-Options`/`frame-ancestors`; tratado como estado de erro visível, não como bug.
- **Sniff de extensão:** `.m3u8`/`.mp4` sem extensão visível na `pathname` cai no fallback `GENERIC_IFRAME` em vez de `DIRECT_MEDIA`.
- **Qualidade de reprodução:** o YouTube removeu a API pública de qualidade (ver `docs/specs/02-fullscreen-lag-qualidade/spec.md`, seção 9.4); não há teto de resolução para YouTube nem para `.mp4`/`.webm` progressivo.
- **Estado efêmero:** `storage.player` continua "tocando" numa sala abandonada; quem chega depois depende de `expectedPlaybackTime()` (staleness + clamp por duração).

## Anexo A — numeração legada (âncoras citadas pelo código)

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| seção 2 | Contratos de eventos Liveblocks | FR-006 a FR-016 | hooks/useChat.ts:12 |
| seção 3 | Rotas / páginas (App Router) | FR-017, FR-018, FR-022 | components/room/player/LoadVideoModal.tsx:9 |
| seção 6 | Variáveis de ambiente / serviços externos | FR-041, FR-042 | components/room/RoomExperience.tsx:319 |
| seção 7 | Fontes de vídeo suportadas e limites técnicos | FR-023 a FR-040 | lib/video-source.ts:8, lib/video-source.ts:82, lib/video-source.ts:165, hooks/useNativeVideoSync.ts:21, hooks/useNativeVideoSync.ts:415, components/room/PlayerLoadStatus.tsx:9, components/room/GenericIframe.tsx:6, components/room/RoomExperience.tsx:305 |
| seção 8 | Direção visual (monocromática, minimalista) | FR-043 a FR-051 | hooks/useLastRoomEvent.ts:16, lib/room-code.ts:4, components/room/player/LoadVideoModal.tsx:9, components/room/RoomExperience.tsx:331, app/globals.css:4, app/globals.css:10 |

> Nota: `hooks/useLastRoomEvent.ts:16` cita "seção 8" mas descreve o filtro de `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK`, cujo conteúdo mora na seção 2 (FR-008/FR-016). A âncora numérica foi preservada como no original; a correção é tarefa separada.
