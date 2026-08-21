# RockNCine — Spec do MVP

Site estilo Rave: link de vídeo colado numa sala (YouTube como caso principal com sync completo; Vimeo e embeds genéricos como fontes adicionais), player sincronizado entre participantes onde a fonte permite, chat ao vivo.

## Decisões travadas

- Auth: NextAuth Credentials (email + senha, hash no Postgres). Sem OAuth no MVP.
- Chat: não persiste. Vive só no Liveblocks storage/broadcast durante a sessão da sala.
- Sala: permanece indefinidamente após todos saírem. Sem expiração/cleanup no MVP.
- Controle de player: qualquer participante pode play/pause/seek. Sem role de "dono com controle exclusivo".

---

## 1. Modelo de dados (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  createdAt    DateTime @default(now())

  ownedRooms Room[]       @relation("RoomOwner")
  memberships RoomMember[]
}

enum VideoSource {
  YOUTUBE
  VIMEO
  GENERIC_IFRAME
}

model Room {
  id             String       @id @default(cuid())
  code           String       @unique @default(cuid()) // usado no link/código de convite
  name           String?
  videoSourceUrl String?      // link original colado pelo usuário
  videoSource    VideoSource?
  embedUrl       String?      // URL final usada no player: videoId (YouTube/Vimeo) ou iframe src genérico
  ownerId        String
  owner          User         @relation("RoomOwner", fields: [ownerId], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  members RoomMember[]

  @@index([code])
}

model RoomMember {
  id       String   @id @default(cuid())
  roomId   String
  userId   String
  room     Room     @relation(fields: [roomId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
  joinedAt DateTime @default(now())

  @@unique([roomId, userId])
}
```

Sem model `Message` — chat não persiste (decisão travada). `owner` existe só para exibir "criado por" e permitir futura extensão de moderação; não bloqueia controle de player.

`videoSourceUrl`/`videoSource`/`embedUrl` em `Room` guardam o último vídeo carregado — permite reabrir a sala depois e já achar o vídeo anterior, mesmo com Liveblocks storage efêmero entre sessões ativas.

---

## 2. Contratos de eventos Liveblocks

Room = um Liveblocks Room (`roomId` do Liveblocks = `Room.code` do Postgres).

### Storage (estado compartilhado persistente da sala Liveblocks, LiveObject)

```ts
type RoomStorage = {
  video: {
    source: "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME" | "DIRECT_MEDIA" | null;
    embedUrl: string | null;   // videoId (YouTube/Vimeo), URL direta (DIRECT_MEDIA) ou iframe src genérico
    sourceUrl: string | null;  // link original colado pelo usuário
    loadedAt: number | null;   // epoch ms, muda a cada "carregar" — inclusive pra URL idêntica repetida
  };
  player: {
    isPlaying: boolean;
    currentTime: number;   // segundos, na última ação de controle — só relevante pra YOUTUBE/VIMEO
    updatedAt: number;     // epoch ms, pra calcular drift esperado por quem chegou depois
    lastActorId: string;   // quem disparou a última ação
  };
};
```

### Broadcast events (`room.broadcastEvent`, efêmero, não fica em storage)

```ts
type PlayerEvent =
  | { type: "LOAD_VIDEO"; source: "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME" | "DIRECT_MEDIA"; embedUrl: string; sourceUrl: string; actorId: string; ts: number }
  | { type: "PLAY"; time: number; actorId: string; ts: number }
  | { type: "PAUSE"; time: number; actorId: string; ts: number }
  | { type: "SEEK"; time: number; actorId: string; ts: number };

type ChatEvent = {
  type: "CHAT_MESSAGE";
  id: string;        // uuid client-side, pra key de lista/dedupe
  authorId: string;
  authorName: string;
  text: string;
  ts: number;
};
```

Fluxo: quem dispara a ação escreve em `storage.player` (fonte de verdade) e broadcasta o evento (pra listeners reagirem sem esperar round-trip de storage). Todo cliente escuta `PLAY`/`PAUSE`/`SEEK` e aplica no próprio player local.

`LOAD_VIDEO` dispara sempre que alguém cola um novo link — todo cliente atualiza `storage.video` e recarrega o player/iframe com o `embedUrl` recebido.

`storage.video.loadedAt` existe só pra forçar o efeito de (re)criação do player a rodar de novo mesmo quando `source`/`embedUrl` não mudam de valor — ex.: recarregar a URL idêntica que acabou de falhar. Sem esse campo, o efeito do hook de sync depende só de `embedUrl`/`source`, e uma retentativa com a mesma URL não muda nenhuma dependência — vira um no-op silencioso em todo participante da sala (era um bug real: ver seção 7).

**Importante:** `PLAY`/`PAUSE`/`SEEK` só têm efeito real para `source: "YOUTUBE"`, `"VIMEO"` ou `"DIRECT_MEDIA"` — ver seção 7 sobre por quê.

### Drift correction

- Cada cliente roda um `setInterval` (ex. a cada 3s) comparando `player.getCurrentTime()` local com `storage.player.currentTime + (Date.now() - storage.player.updatedAt) / 1000` (se `isPlaying`).
- Se `|diff| > 1.5s`, força `seekTo(expected)` local. Não gera novo broadcast — é correção silenciosa, não uma ação de usuário.
- Só roda para `source: "YOUTUBE"` ou `"VIMEO"` — sem API de player exposta (caso `GENERIC_IFRAME`), não há `getCurrentTime`/`seekTo` pra chamar.

### Presence (por conexão, `useMyPresence` / `useOthers`)

```ts
type Presence = {
  userId: string;
  name: string;
};
```

Chat não fica no `Presence` nem no `Storage` — é só broadcast; histórico de mensagens vive em estado React local (array em memória), reconstituído a zero pra quem entra depois.

---

## 3. Rotas / páginas (App Router)

```
app/
  layout.tsx                     # providers globais (SessionProvider)
  page.tsx                       # landing / redirect pra /login ou /rooms
  login/
    page.tsx                     # form de login (Credentials)
  register/
    page.tsx                     # form de cadastro
  rooms/
    page.tsx                     # menu: criar sala / entrar por código
    new/
      route.ts                   # POST — cria Room, redireciona 303 pra /rooms/[code] (303, não o 307 default, senão o browser repete o POST no destino)
  rooms/[code]/
    page.tsx                     # sala: player + chat + presence (Server Component busca Room; Client Component monta LiveblocksProvider)
    layout.tsx                   # valida sessão, garante RoomMember (upsert on join)
    not-found.tsx                # 404 estilizado — sala inexistente
    video/
      route.ts                   # PATCH — persiste o vídeo resolvido (source/embedUrl/sourceUrl) no Room do Postgres, gated por RoomMember
  not-found.tsx                  # 404 global estilizado
  api/
    auth/[...nextauth]/route.ts  # NextAuth handler
    register/route.ts            # POST — cadastro (bcrypt.hash, prisma.user.create)
    liveblocks-auth/route.ts     # endpoint de auth do Liveblocks (authorize por sessão NextAuth + RoomMember)
    resolve-embed/route.ts       # POST — ver seção 7
```

`proxy.ts` na raiz protege `/rooms/**` — redireciona não-autenticado pra `/login`. (Next.js 16 renomeou `middleware.ts` → `proxy.ts`; o padrão `withAuth(...)` como default export continua válido, só muda o nome do arquivo.)

---

## 4. Fluxo de autenticação (NextAuth)

- Provider: `CredentialsProvider` único. `authorize()` normaliza o email recebido (`trim().toLowerCase()`) antes de buscar `User`, compara senha com `bcrypt.compare` contra `passwordHash`. A normalização espelha a que já acontece no cadastro (`/api/register`) — sem ela, um usuário que loga com capitalização diferente da que usou ao se cadastrar (autofill, copiar/colar) toma "credenciais inválidas" mesmo com a senha certa, já que `email` é `@unique` case-sensitive no Postgres.
- Session strategy: `jwt` (sem tabela `Session` no Prisma — não precisa do adapter de banco pra sessão, só pra usuário).
- `/register`: form próprio (não é rota do NextAuth) → server action ou route handler que faz `bcrypt.hash` e `prisma.user.create`.
- `session.user.id` populado via callback `jwt`/`session` a partir do `sub` do token, pra `RoomMember`/presence usarem o `User.id` real.

---

## 5. Fases de implementação

1. **Skeleton de auth + salas** — NextAuth Credentials, `/register`, `/login`, Prisma migrate inicial (`User`, `Room`, `RoomMember`), menu `/rooms` (criar / entrar por código), página de sala vazia (só mostra membros via query, sem Liveblocks ainda).
2. **Presence + player sync (YouTube)** — integra Liveblocks (`liveblocks-auth`, `LiveblocksProvider`), hook `useYouTubePlayer` via `useSyncedPlayer`, storage `player`/`video`, broadcast de `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK`, drift correction, lista de presence. Só YouTube nessa fase — valida o mecanismo de sync antes de generalizar.
3. **Chat** — broadcast `CHAT_MESSAGE`, lista local reconstituída por sessão.
4. **Fontes adicionais** — adapter Vimeo (`useVimeoPlayer`, sync completo via Player SDK) e fallback `GENERIC_IFRAME` (`useIframeEmbed`, load-only, sem controle). Extração server-side por `POST /api/resolve-embed` (ver seção 7).
5. **Polish** — parsing de formatos variados de URL do YouTube (watch, youtu.be, shorts, com timestamp) e Vimeo, estados de erro (link inválido, embed bloqueado por X-Frame-Options/CSP, sala inexistente), loading states.

Cada fase termina com o app rodando ponta a ponta — fase 2 sem chat ainda é demo válida, fase 3 fecha o MVP com YouTube. Fase 4 é a extensão pedida pra fontes além do YouTube.

---

## 6. Variáveis de ambiente / serviços externos

| Variável | Origem | Observação |
|---|---|---|
| `DATABASE_URL` | Neon ou Supabase (Postgres free tier) | Neon tem free tier serverless mais alinhado a deploy na Vercel (connection pooling via `-pooler` já embutido na URL) |
| `NEXTAUTH_SECRET` | gerado local (`openssl rand -base64 32`) | obrigatório em produção |
| `NEXTAUTH_URL` | URL do deploy Vercel | ex. `https://rockncine.vercel.app` |
| `LIVEBLOCKS_SECRET_KEY` | Liveblocks project (free tier) | usado só no endpoint `/api/liveblocks-auth`, nunca no client |
| `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` | Liveblocks project | opcional — só se optar por auth pública em vez de endpoint de auth; com Credentials + auth por sessão, preferir o secret key + endpoint de auth, não expor public key |

Serviços a provisionar antes da fase 1: projeto Postgres (Neon/Supabase em produção; dev local usa container `postgres:16-alpine` via Docker, mesma `DATABASE_URL` shape) e projeto Liveblocks. Vercel só entra no deploy, não bloqueia desenvolvimento local.

A badge "Powered by Liveblocks" é exigência do plano Free (remover é feature paga, Pro+) — não
escondida via CSS. `LiveblocksProvider` usa `badgeLocation="bottom-left"` (prop oficial) só pra
reposicionar, saindo de baixo do chat/aside.

---

## 7. Fontes de vídeo suportadas e limites técnicos

### Detecção de fonte (server-side, `POST /api/resolve-embed`)

Recebe `{ url: string }`, retorna `{ source, embedUrl, sourceUrl }` ou erro. Roda no servidor (não no client) pra evitar CORS na consulta de oEmbed e pra não deixar o client decidir sozinho que conteúdo remoto processar.

1. URL bate com padrão do YouTube (`youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/`) → extrai `videoId`, `source: YOUTUBE`. Client monta `https://www.youtube.com/embed/{id}` via IFrame API.
2. URL bate com padrão do Vimeo (`vimeo.com/{id}`) → resolve via oEmbed público do Vimeo (`https://vimeo.com/api/oembed.json?url=...`), extrai o `videoId` do `iframe src` retornado, `source: VIMEO`.
3. URL bate com padrão do Google Drive (`drive.google.com/file/d/{id}/view`, `/open?id={id}`, ou já `/preview`) → extrai `{id}` por regex e monta `embedUrl = https://drive.google.com/file/d/{id}/preview`. Necessário porque o link de compartilhamento padrão (`/view`) não é embutível — só a variante `/preview` libera `frame-ancestors`. `source: GENERIC_IFRAME` (Drive não expõe API de controle via `postMessage`, então cai no mesmo nível de sync do item 5 — só `LOAD_VIDEO`).
4. URL termina em `.mp4`/`.webm`/`.m3u8` (sniff de extensão no `pathname`, com ou sem query string depois) → `source: DIRECT_MEDIA`, `embedUrl` = a própria URL. Tocado num `<video>` próprio (`.mp4`/`.webm` direto; `.m3u8` via `hls.js` em browsers com MSE, ou `video.src` nativo no Safari, que já suporta HLS sem precisar de `hls.js`). **Limitação conhecida**: é só sniff de extensão, sem `HEAD`/checagem de `Content-Type` (consistente com a regra de não fazer proxy/scraping de terceiro abaixo) — uma URL assinada sem extensão visível na `pathname` cai no fallback genérico do item 5 em vez de ser detectada como mídia direta.
5. Qualquer outra URL → tratada como `GENERIC_IFRAME`: `embedUrl` = a própria URL colada, usada direto como `iframe src`. Sem scraping de HTML, sem oEmbed discovery genérico no MVP — o usuário cola o link que já é o player embutível (uma URL de `.../player.html?...`, por exemplo), não a página do site. Cobre "qualquer link com vídeo" como fallback universal — cada novo padrão conhecido (como Drive acima) só ganha um passo próprio na lista quando precisa de transformação de URL pra funcionar num iframe; senão o fallback genérico já resolve. **Deliberadamente não faz scraping/extração de stream de sites de terceiro** (ex. agregadores de streaming) pra montar um `DIRECT_MEDIA` a partir da página deles — isso seria bypassar o mecanismo de entrega deles pra redistribuir conteúdo que não é nosso pra redistribuir, fora de escopo independente de quão conveniente seria tecnicamente.

### Por que YouTube, Vimeo e mídia direta sincronizam e o resto não

YouTube (IFrame Player API) e Vimeo (Player SDK) expõem uma API JS baseada em `postMessage` que o parent (nosso app) chama pra controlar o player dentro do iframe, mesmo sendo cross-origin — é assim que `play()`/`pause()`/`seekTo()`/`getCurrentTime()` funcionam nesses dois casos. `DIRECT_MEDIA` sincroniza pelo mesmo motivo por um caminho mais direto ainda: é um `<video>` nosso, sem iframe nenhum no meio, então `play()`/`pause()`/`currentTime` são só a API nativa do elemento.

Um iframe genérico de terceiro normalmente não expõe esse contrato — é uma janela cross-origin isolada por padrão do navegador. Sem o player do lado de dentro implementar seu próprio protocolo de `postMessage`, não há como o nosso JS chamar play/pause/seek nele. Por isso, para `GENERIC_IFRAME`:

- `LOAD_VIDEO` sincroniza — todo mundo abre o mesmo link ao mesmo tempo.
- `PLAY`/`PAUSE`/`SEEK` não têm efeito nenhum — cada participante controla o próprio player manualmente dentro do iframe, sem sync, sem drift correction (não há `getCurrentTime` pra comparar).
- UI precisa deixar isso explícito (ex. badge "sync limitado — controle manual" quando `source === "GENERIC_IFRAME"`), pra não passar a impressão de que o play/pause de alguém vai refletir nos outros quando não vai.

### Segurança / robustez do iframe genérico

- `iframe` renderizado com `sandbox="allow-scripts allow-same-origin allow-presentation"` — sem `allow-top-navigation`, sem `allow-popups` por padrão — reduz o que um embed de terceiro não confiável pode fazer na página.
- Alguns sites bloqueiam embed via `X-Frame-Options`/`Content-Security-Policy: frame-ancestors` — nesse caso o iframe fica em branco. Tratar como estado de erro visível ("este link não permite ser incorporado"), não como bug silencioso.
- `/api/resolve-embed` não segue redirects nem baixa/executa HTML de terceiros no servidor — só valida formato de URL (regex por domínio conhecido pra YouTube/Vimeo; pra genérico, valida que é uma URL bem formada com protocolo `https`) e devolve. Sem proxy de conteúdo.
- Escopo do MVP é o mecanismo de embed (extrair e sincronizar um iframe), não curadoria de fontes — a responsabilidade sobre ter direito de uso/embedar o conteúdo colado é de quem cola o link, não da aplicação.

### Robustez do player YouTube/Vimeo (lições de um bug real em produção)

Um relatório real: um vídeo do YouTube carregou preto sem nenhum erro visível; recarregar o mesmo link mais tarde funcionou, sem nenhuma mudança de código/ambiente entre as duas tentativas. Investigação (revisão de código completa pós-incidente) achou três causas reais, nenhuma ligada a bloqueador de anúncio, Brave Shields ou restrição do vídeo em si (hipóteses descartadas por teste do usuário: um vídeo diferente carregou normalmente mesmo com Shields ativo):

1. **Script da API do YouTube sem timeout/`onerror`.** `loadYouTubeIframeApi()` guarda um `Promise` singleton a nível de módulo (sobrevive a navegação client-side entre salas). Sem tratar falha de carga do `<script src="youtube.com/iframe_api">`, uma falha transitória de rede deixava essa promise pendente pra sempre — todo carregamento futuro de vídeo YouTube na mesma sessão de aba ficava preso, tela preta, sem erro, só resolvível com reload de página (que reavalia o módulo do zero). Corrigido: `tag.onerror` + `setTimeout(10s)` rejeitam a promise e resetam o singleton pra `null`, permitindo que a próxima tentativa recarregue o script sem precisar de reload.
2. **Retentativa com a mesma URL era um no-op silencioso.** O efeito que cria/atualiza o player do YouTube/Vimeo dependia só de `video.embedUrl`/`video.source` — colar de novo o link idêntico gera o mesmo `videoId`, então nenhuma dependência do efeito muda, e React nunca reexecuta. Corrigido com `storage.video.loadedAt` (epoch ms, escrito a cada "carregar" mesmo pra URL repetida) incluído nas dependências do efeito — força a recriação/reload do player mesmo sem mudança de `videoId`. Também zera o timeout de loading (`PlayerLoadStatus` agora usa `` `${embedUrl}-${loadedAt}` `` como `key`, não só `embedUrl`).
3. **Player preso numa ref morta ao trocar de fonte e voltar.** O container `#yt-player`/`#vimeo-player` só existe no DOM enquanto `video.source` é `"YOUTUBE"`/`"VIMEO"` (ternário em `RoomExperience`) — trocar pra outra fonte desmonta esse `div`. A instância do player em `playerRef.current`, porém, só era destruída no unmount do hook inteiro (sair da sala), nunca nessa troca de fonte. Resultado: carregar YouTube → trocar pra Vimeo/genérico → voltar pro YouTube reusava a ref antiga contra um `div` recém-montado (mesmo `id`, nó DOM diferente) — falha silenciosa, sem `onReady` nem `onError`. Corrigido: o efeito agora destrói e zera a ref assim que `video.source` deixa de ser a fonte daquele hook, então um load futuro sempre constrói um player novo contra o container atual.

Além disso, os hooks de sync agora tratam `onError` do YouTube (`100`: vídeo não encontrado/privado; `101`/`150`: dono desabilitou embed nesse player) e `error` do Vimeo Player SDK, expondo uma mensagem específica via `PlayerLoadStatus` assim que o SDK reporta — em vez de depender só do timeout genérico de 8s da fase 5. Isso cobre o caso de restrição real por parte do dono do vídeo, que é diferente e mais raro do que o bug acima.

### Chrome de player próprio (`PlaybackController`)

`YOUTUBE`/`VIMEO`/`DIRECT_MEDIA` escondem o controle nativo do backend (YouTube: `playerVars: {controls: 0, disablekb: 1}`; Vimeo: `new Player(el, {controls: false})`; `<video>` nativo já não tem chrome por padrão) e renderizam uma barra própria (`components/room/player/PlayerControls.tsx`) por cima, visualmente coesa com o resto do app.

Cada hook de sync (`useYouTubeSync`, `useVimeoSync`, `useNativeVideoSync`) retorna um `controller: PlaybackController` (`hooks/playerController.ts`) — formato comum de `{isReady, isPlaying, currentTime, duration, volume, isMuted, error, play, pause, togglePlay, seek, setVolume, toggleMute}` que a barra consome sem saber qual backend está por trás. `RoomExperience` escolhe o controller ativo (o do hook cujo `source` bate com `video.source`) e passa pra `<PlayerShell>`, que envolve o container do player + a barra como overlay (mostra/esconde por inatividade).

Chamar `controller.play()`/`pause()`/etc. não precisa de broadcast próprio: os listeners que cada hook já registra (`onStateChange`, `player.on('play'|'pause'|'seeked')`, eventos nativos de `<video>`) capturam a mudança de estado e disparam `commitPlayer`+`broadcast` como já faziam antes da barra existir — ela é só mais um chamador da mesma API imperativa que os SDKs expõem. Exceção: `seek()` broadcasta explicitamente em todo backend, porque nem toda API expõe um evento de "seek concluído" que dispararia isso sozinho.

`volume`/`isMuted` do `PlaybackController` são sempre locais, nunca sincronizados — cada participante controla o próprio áudio (a funcionalidade de mute de *presença* — mutar indicando aos outros — foi removida, não é necessária pro MVP).

Ícones da barra (`components/room/player/icons.tsx`) são SVG desenhado à mão, `currentColor`, sem dependência de icon-lib — decisão consistente com o rebrand monocromático da seção 8.

**Fullscreen mora em `RoomExperience`, não em `PlayerShell`.** `PlayerShell` só cuida do auto-hide
da barra por inatividade e recebe `isFullscreen`/`onToggleFullscreen` como props. Quem chama
`requestFullscreen()` é um `stageRef` em `RoomExperience` que envolve as duas colunas (vídeo +
aside), não só o vídeo — necessário pro "modo teatro" (seção 8) caber chat dentro da tela cheia.

**Overlay pra esconder o chrome nativo do YouTube pausado.** Sem parâmetro oficial da IFrame API
pra desligar a tela de sugestões que o YouTube desenha por cima ao pausar (mesmo com
`controls: 0`) — `RoomExperience` cobre o iframe com um `div` opaco nosso (`bg-[var(--bg-void)]`)
sempre que `youtubeController.isReady && !youtubeController.isPlaying`, com um botão de play
centralizado que também serve de affordance. Só se aplica a `YOUTUBE` — Vimeo/mídia direta não têm
esse overlay nativo.

---

## 8. Direção visual (monocromática, minimalista)

Princípio geral: o vídeo é o objeto — a UI existe pra sumir ao redor dele, como uma sala escura em volta de uma tela. Nada de decoração que compita com o player.

### Paleta (dark-first, estritamente monocromática)

Zero cor de marca — preto, branco, cinza, só. Estado é sinalizado por **contraste/inversão/peso**, nunca por matiz. Referência de linha: a vertente "ink-is-the-brand" (ex. Vercel/Geist) — ação primária é uma inversão de polaridade (bloco sólido invertido), foco usa espessura/contraste em vez de cor, hierarquia vem de peso e espaçamento.

| Token | Hex | Uso |
|---|---|---|
| `--bg-void` | `#0A0A0A` | fundo base |
| `--bg-surface` | `#141414` | painéis: chat, sidebar de presence, modais |
| `--line` | `#2A2A2A` | divisores e bordas, sempre discretos |
| `--ink` | `#F2F2F2` | texto primário — branco suave, não `#FFF` puro (reduz halo/glare em ambiente escuro) |
| `--ink-muted` | `#7A7A7A` | metadados: timestamps, nomes secundários, placeholders |
| `--invert-bg` | `#FFFFFF` | CTA primário / estado ativo — bloco sólido invertido, substitui o antigo acento |
| `--invert-fg` | `#000000` | texto/ícone sobre `--invert-bg` |
| `--outline-strong` | `#FFFFFF` | foco (anel duplo: `ring` + `ring-offset` sobre `--bg-void`), borda de estado "ao vivo" |

Substituição de semântica, aplicada em todo botão/link/estado que antes usava o acento laranja: **CTA primário** = bloco `--invert-bg`/`--invert-fg` (não mais cor de fundo colorida); **foco** = anel duplo em `--outline-strong` com `ring-offset` em `--bg-void` (espessura/contraste, não cor); **erro** = bloco com borda em `--ink` + texto em negrito (antes usava a mesma cor do CTA, o que confundia os dois sinais); **link** = `--ink` com sublinhado sempre visível (não pode depender só de cor); **presença ativa** = ponto sólido em `--ink`.

### Tipografia (3 papéis)

- **Display** — grotesk geométrico, tracking apertado. Só em momentos grandes: título da sala, estados vazios ("nenhuma sala ainda"). Nunca em texto de corpo — é pra pontuar, não pra preencher.
- **Corpo** — sans humanista, legível em tamanho pequeno (chat é denso). É a fonte de 90% da UI: mensagens, labels, botões, formulários.
- **Utilitária (mono)** — pra código da sala, timestamp do chat, e qualquer diagnóstico de sync (`currentTime`, drift em ms). Mono aqui não é estética — é funcional: elimina ambiguidade `0`/`O`, `1`/`l` num código que a pessoa vai ditar ou colar pro amigo entrar na sala.

### Assinatura visual: anel de sync ao redor do vídeo

Sem cor pra diferenciar estado, o anel usa três tratamentos estruturais (`components/room/SyncRing.tsx`): borda sólida em `--line` (idle/pausado), borda sólida em `--outline-strong` (branca) com pulso lento (`isPlaying`), e borda **tracejada** em `--line` quando `source === "GENERIC_IFRAME"` (seção 7) — o tracejado é o único jeito de comunicar "essa sala não tem sync de play/pause real" sem depender de matiz. A cada evento `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK` recebido de qualquer participante (seção 2), o anel dá um flash breve em branco — um eco visual real do broadcast, não um efeito decorativo solto.

### Layout

Desktop — proporção real de ~80% vídeo / ~20% chat+presença (`lg:basis-[80%]`/`lg:basis-[20%]`
em `RoomExperience.tsx`, container solto de `max-w-6xl` pra `max-w-[1800px]` — em 1152px, 80%
ainda era só ~920px de vídeo, não sobrava espaço real):

```
┌───────────────────────────────────────────────────────┬─────────────┐
│                                                         │  presença ＋│
│                                                         │  ● ● ●   3  │
│              ╭─────────────────────────────╮           ├─────────────┤
│              │                              │           │  chat       │
│              │       [ vídeo, ~80% ]        │           │  ...        │
│              │                              │           │  ...        │
│              ╰─────────────────────────────╯           │  ...        │
│  ● ao vivo · sincronizado           00:12:34            ├─────────────┤
│                                                          │ [ mensagem ]│
└───────────────────────────────────────────────────────┴─────────────┘
```

`+` no cabeçalho de presença abre o modal de carregar link (`LoadVideoModal.tsx`) — o form de colar
URL não fica mais fixo embaixo do vídeo, evitando competir por atenção com o player.

Tela cheia: por padrão o vídeo ocupa 100% da tela (chat escondido, imersivo). Um botão
(`TheaterIcon`, só visível em fullscreen) alterna "modo teatro" — vídeo encolhe pra ~80% e o
chat/presença aparece à direita, dentro da própria tela cheia (o alvo do `requestFullscreen()` é o
container que envolve as duas colunas, não só o vídeo, exatamente pra isso caber). Reseta pra
vídeo-só toda vez que sai da tela cheia. **Geometria e posição exatas desse botão: seção 9.1** —
o layout de tela cheia descrito aqui foi refeito (centralizado, com margem em todos os lados) e o
botão saiu do canto flutuante.

Mobile — coluna única, vídeo sempre primeiro; chat/presence colapsam abaixo (aba ou bottom sheet), nunca disputam espaço com o player.

### Piso de qualidade (não negociável, independe de tema)

- Contraste `--ink` sobre `--bg-void` e `--bg-surface` dentro de AA pra texto de corpo.
- Todo elemento interativo tem estado de foco visível (anel duplo em `--outline-strong`), inclusive em navegação por teclado.
- `prefers-reduced-motion` desliga o pulso do anel de sync e qualquer transição não-essencial — vira só o flash instantâneo de estado, sem animação contínua.
- Alvos de toque em mobile ≥ 44px (chat, controles do player, entrar na sala) — sala é usada por 2 pessoas, muitas vezes em celular deitado no sofá, não em mesa com mouse.

---

## 9. Tela cheia centrada, diagnóstico de lag e teto de qualidade

Rodada motivada por dois relatos do usuário: (a) em tela cheia o vídeo não fica centrado e nada
respeita margem — chat colado na borda direita da tela, vídeo colado nas outras três; (b) "o vídeo
às vezes laga", com pedido explícito de limitar toda reprodução a 720p. Esta seção é a spec de
implementação das duas coisas; nenhum código foi escrito nesta rodada.

### 9.1 Layout de tela cheia: centrado, com respiro em todos os lados

**Por que hoje fica colado na borda.** O padding que dá respiro ao conteúdo da sala vive no `<main>`
(`px-6 py-8`, `RoomExperience.tsx:110`), mas o alvo de `requestFullscreen()` é o `stageRef`
(`RoomExperience.tsx:132-135`), que é *filho* do `main`. Ao entrar em tela cheia, o elemento
fullscreen passa a ter o tamanho exato do viewport e o padding do ancestral deixa de valer — o stage
vira uma caixa 100vw × 100vh sem padding próprio. A caixa do vídeo é `aspect-video w-full`
(`RoomExperience.tsx:154`): com largura livre de 100vw ela cresce até encostar nas laterais e, em
telas mais largas que 16:9, ainda estoura a altura disponível. O `aside` (`:214`) não tem margem
própria, então encosta na borda direita.

**Regra geral desta spec:** em tela cheia, quem dá o respiro é o **próprio elemento fullscreen**
(o `stageRef`), nunca um ancestral. E a caixa do vídeo é limitada pelos **dois** eixos, não só pela
largura.

Alterações, todas condicionadas a `isFullscreen` (fora de tela cheia o layout atual permanece
exatamente como está):

1. **Padding no stage** (`RoomExperience.tsx:132-135`). Adicionar, quando `isFullscreen`:
   `h-dvh w-dvw overflow-hidden p-[clamp(0.75rem,2.5vmin,2.5rem)]`. `vmin` faz a margem escalar com
   a menor dimensão da tela (respiro proporcional em 1080p e em ultrawide), com piso pra telas
   pequenas e teto pra não desperdiçar área em 4K. O stage já tem `bg-[var(--bg-void)]`, então a
   margem fica preta-void e não o preto default do `::backdrop` — manter.
2. **Coluna do vídeo centrada** (`RoomExperience.tsx:148`). Adicionar `min-h-0 justify-center` à
   coluna (ela já é `flex flex-col`); em tela cheia a coluna também precisa de `flex-1`. Isso
   centraliza verticalmente o bloco `SyncRing` + vídeo dentro da altura útil.
3. **Caixa do vídeo limitada pela altura, não só pela largura**
   (`RoomExperience.tsx:154`, o `div` com `aspect-video w-full`). Em tela cheia acrescentar:
   `max-w-[min(100%,calc((100dvh-2*var(--fs-pad))*16/9))] mx-auto`, com `--fs-pad` declarado no
   stage com o mesmo `clamp()` do item 1 (declarar o token no `style` inline do stage ou como
   utility em `globals.css`; um valor literal duplicado nos dois lugares também funciona, mas
   dessincroniza). É o truque clássico de encaixar 16:9 numa caixa: a largura tenta 100%, mas nunca
   passa da largura que a altura disponível comporta — sem brigar com `aspect-ratio`, sem
   `object-fit`, sem distorcer a caixa. Resultado: em qualquer proporção de tela o vídeo fica
   centrado com barras de `--bg-void` sobrando no eixo folgado, e o padding do item 1 garante que
   ele nunca encoste em borda alguma.
4. **`aside` com margem e forma própria em tela cheia** (`RoomExperience.tsx:214`). O padding do
   stage já descola o painel da borda direita; além disso, em `isFullscreen && isTheater` o `aside`
   ganha `rounded-lg border border-[var(--line)] bg-[var(--bg-surface)] p-4` pra ler como painel
   flutuante dentro da tela cheia, e não como uma coluna cortada pela borda. Fora de tela cheia
   continua sem moldura (o chat já tem a sua).
5. **Sem scroll na tela cheia.** `overflow-hidden` no stage (item 1) + `min-h-0` na coluna do vídeo
   e no `aside` (esse já tem) evitam que o chat empurre a altura e crie barra de rolagem dentro do
   elemento fullscreen.

Piso de qualidade herdado da seção 8: nada disso pode depender de matiz, e a margem não é
decoração — é o que impede o vídeo de brigar com a borda física do monitor.

### 9.2 Onde mora o botão de "modo teatro"

Hoje ele flutua solto em `absolute right-2 top-2` dentro do stage (`RoomExperience.tsx:136-146`),
descolado de qualquer outro controle. Pedido do usuário: ficar **imediatamente à direita do botão
"carregar vídeo"** (`RoomExperience.tsx:220-227`), que vive no cabeçalho da seção de presença. O
problema é que esse cabeçalho só existe quando o `aside` é renderizado, e em tela cheia sem teatro o
`aside` não existe (`showAside = !isFullscreen || isTheater`, `:107`).

**Decisão: o par vira uma unidade, e só a âncora muda.** Extrair um componente
`components/room/RoomActions.tsx` que renderiza sempre os mesmos dois botões, na mesma ordem e com o
mesmo estilo (`flex items-center gap-2`): `[＋ carregar vídeo]` e, à direita dele, `[teatro]`.
Props: `onLoadVideo`, `onToggleTheater`, `isTheater`, `showTheaterToggle`. Nunca é renderizado duas
vezes ao mesmo tempo.

| Estado | `showAside` | Onde `RoomActions` é renderizado | Botão de teatro |
|---|---|---|---|
| Fora de tela cheia | `true` | cabeçalho da seção de presença, lado direito do `justify-between` (onde o "carregar vídeo" já está hoje) | **não renderizado** (`showTheaterToggle=false`) — teatro só significa algo dentro de fullscreen |
| Tela cheia + teatro **ligado** | `true` | mesmo lugar: cabeçalho de presença, dentro do `aside` | renderizado, colado à direita do "carregar vídeo" — exatamente o pedido |
| Tela cheia + teatro **desligado** | `false` | overlay ancorado no **canto superior direito da coluna do vídeo** (não do stage): a coluna (`RoomExperience.tsx:148`) ganha `relative`, e o cluster vai em `absolute right-3 top-3 z-20` | renderizado, na mesma ordem e com o mesmo visual |

Detalhes que fecham a decisão:

- A âncora do overlay é a **coluna do vídeo**, não o stage — assim o cluster já nasce dentro do
  padding da 9.1 e nunca encosta na borda da tela.
- Fundo do overlay: pílula `rounded-md border border-[var(--line)] bg-[var(--bg-void)]/90`. **Sem
  `backdrop-blur`** — ver 9.3, item 5.
- Visibilidade: no estado tela-cheia-sem-teatro esse cluster é o único caminho de volta pro chat,
  então não some por inatividade; fica em `opacity-60`, subindo pra `opacity-100` em
  `hover`/`focus-within`. (Diferente da barra de controles, que continua com o auto-hide do
  `PlayerShell`.)
- Acessibilidade preservada do botão atual: `aria-pressed={isTheater}` e `aria-label` alternando
  entre "expandir vídeo" / "abrir chat ao lado"; anel de foco duplo da seção 8.
- Ao sair da tela cheia, `isTheater` já é zerado (`RoomExperience.tsx:55`), então o cluster volta
  sozinho pro cabeçalho de presença sem o botão de teatro. Nenhum estado novo é necessário.

### 9.3 Diagnóstico do "vídeo lagando"

Lista fechada: só entra o que dá pra apontar no código. Cada item traz veredito explícito.

1. **`border-width` animado a cada 3s — CONFIRMADO, já corrigido.** `.animate-sync-pulse`
   (`app/globals.css:46`) animava `border-width` (2px↔3px) em loop enquanto qualquer vídeo tocava.
   `border-width` é propriedade de layout: cada frame da animação forçava reflow, no ancestral
   direto do elemento de vídeo. Hoje é `box-shadow` estático, sem keyframe (ver seção 8, "Assinatura
   visual: anel de sync"). Não refazer.
2. **Re-render da árvore inteira da sala 2,5–4×/s durante o playback — CONFIRMADO.** Os três hooks
   de sync são chamados no topo de `RoomExperience` (`:69-76`) e guardam `currentTime` em `useState`
   local:
   - YouTube: `TIME_POLL_MS = 400` (`hooks/useYouTubeSync.ts:13`) com `setCurrentTime` a cada tick
     (`:209-222`) — 2,5 renders/s.
   - Vimeo: `timeupdate` do SDK chamando `setCurrentTime` (`hooks/useVimeoSync.ts:120-123`) — ~4/s.
   - Mídia direta: `onTimeUpdate` nativo (`hooks/useNativeVideoSync.ts:201`) — ~4/s.

   Como o estado vive no componente que renderiza a sala toda, cada tick re-renderiza
   `RoomExperience` + `Chat` (que remapeia até 200 `<li>`, `components/room/Chat.tsx:35-55`) +
   `PresenceList` + `SyncRing` + `PlayerShell` + `PlayerControls`. Nada é `memo`, e o objeto
   `controller` é recriado a cada render (ex. `useYouTubeSync.ts:317`), então nenhuma barreira de
   memoização adiantaria sem refatorar isso junto. É trabalho de main thread contínuo na mesma
   thread que compõe o vídeo — magnitude a medir com o Profiler, mas a existência do custo é fato,
   não hipótese. Direção de correção: tirar `currentTime`/`duration` do caminho de render
   compartilhado (contexto com seletor, `useSyncExternalStore`, ou manter o scrubber numa folha que
   assina sozinha), `memo` em `Chat`/`PresenceList`, e arredondar `currentTime` (0,1s) pra cortar
   renders redundantes.
3. **Loop de correção de drift com `seekTo` — PLAUSÍVEL, não confirmado.**
   `hooks/useYouTubeSync.ts:225-264`: a cada `CHECK_INTERVAL_MS = 3000`, quem não é dono da última
   ação e está a mais de `DRIFT_THRESHOLD_S = 1.5` do esperado leva
   `player.seekTo(expected, true)` (`:259`). `allowSeekAhead = true` obriga o YouTube a pedir um
   novo range ao servidor e rebufferizar — visualmente é exatamente um "engasgo". Num participante
   com rede ou CPU mais lenta, o drift volta a passar de 1,5s antes dos próximos 3s, e a correção
   vira permanente: engasgo a cada 3 segundos, indefinidamente. Não há histerese, nem backoff, nem
   checagem de `BUFFERING` (o código só testa `PAUSED`, `:244`). Confirmar com log de quantas
   correções por minuto acontecem antes de mexer; correção provável: limiar de reengate maior que o
   de disparo, teto de N correções/minuto e pular a correção enquanto o estado for `BUFFERING`.
4. **Cooldown de 400ms curto demais pra duração real de um seek — PLAUSÍVEL, não confirmado.**
   `REMOTE_APPLY_COOLDOWN_MS = 400` (`useYouTubeSync.ts:12`, `useNativeVideoSync.ts:12`) é um
   `setTimeout` fixo. No YouTube, `seekTo` durante playback produz `BUFFERING` e só depois `PLAYING`;
   se esse `PLAYING` chegar após 400ms, ele escapa do guard e `onStateChange` (`:130-158`) trata a
   correção silenciosa como ação de usuário: `commitPlayer` + `broadcast(PLAY)`. Esse cliente vira
   `lastActorId` e passa a arrastar os outros — realimentando o item 3 em todo mundo. Mesma classe
   de falha na mídia direta: `seeked` disparado depois dos 400ms cai em `onSeeked`
   (`useNativeVideoSync.ts:183-199`) e emite um `SEEK` espúrio. O Vimeo é imune a essa variante
   porque lá o cooldown termina quando a promise resolve, não num timeout fixo
   (`useVimeoSync.ts:43-54`) — o que sugere que a correção certa é generalizar essa abordagem:
   encerrar o cooldown por evento (`PLAYING`/`seeked` observado) e não por relógio.
5. **`backdrop-blur` sobre a área do vídeo — PLAUSÍVEL, custo de GPU.** `PlayerControls.tsx:42` e o
   botão de teatro atual (`RoomExperience.tsx:142`) usam `backdrop-blur-sm`. `backdrop-filter` obriga
   o compositor a reprocessar a região atrás do elemento a cada frame de vídeo enquanto o elemento
   está visível — e o auto-hide da barra só muda opacidade (`PlayerShell.tsx:59-61`), sem tirar do
   DOM nem aplicar `visibility: hidden`, então a camada continua viva mesmo "escondida". Correção
   barata: `invisible` (não só `opacity-0`) quando escondida, e fundo opaco em vez de blur nos
   overlays sobre o vídeo — já refletido em 9.2.
6. **`overflow-hidden rounded-md` na caixa do vídeo — PLAUSÍVEL, não confirmado.**
   `RoomExperience.tsx:154`. Recorte com raio em cima de uma camada de vídeo pode tirar o vídeo do
   caminho rápido de composição/overlay de hardware do navegador. Verificável em minutos com
   "Layer borders" + "Frame rendering stats" do DevTools; teste barato: remover o arredondamento só
   em tela cheia e comparar frames descartados. Não mexer antes de medir.
7. **"Os três hooks de sync rodam ao mesmo tempo" — DESCARTADO como causa de lag.** É verdade que os
   três ficam montados sempre (`RoomExperience.tsx:69-76`), com três `setInterval` de 3s e três
   listeners de broadcast. Mas os hooks inativos saem na primeira linha do tick (`!player` /
   `!videoEl` → `return`, ex. `useYouTubeSync.ts:229`) e o poll de 400ms do YouTube é gated por
   `isReady` (`:210`). Custo desprezível. O que **não** é desprezível é o item 2, que é consequência
   de onde o estado mora, não de quantos hooks existem.
8. **Transição de auto-hide da barra — DESCARTADO.** `transition-opacity duration-200`
   (`PlayerShell.tsx:59`) anima só opacidade: propriedade de compositor, não dispara reflow nem
   repaint de layout. O problema naquele componente é o `backdrop-filter` do item 5, não a
   transição.
9. **Efeito de scroll do chat — DESCARTADO.** `Chat.tsx:17-20` lê `scrollHeight` (leitura forçada de
   layout) num efeito com deps `[messages]`; `messages` é estado estável vindo de `useChat`
   (`hooks/useChat.ts:15-22`), então o efeito só roda quando chega mensagem, não a cada render do
   item 2.

**Expectativa a alinhar com o usuário:** limitar a 720p (9.4) ataca *outra* causa — banda e custo de
decodificação. Não resolve nada dos itens 2, 3 e 4, que são lag gerado pela própria aplicação. Se o
sintoma for "engasga a cada poucos segundos", a aposta é 3+4; se for "trava e volta em rede ruim", é
o teto de qualidade.

### 9.4 Teto de 720p: o que é possível por fonte

Pesquisa verificada contra a documentação oficial e contra as versões instaladas
(`hls.js@1.7.1`, `@vimeo/player@2.30.4`), não de memória. **Resumo: dá pra fazer em 1 das 4 fontes
de forma completa, 1 de forma parcial e condicionada, e 2 não dá.**

| Fonte | Teto de 720p | Mecanismo |
|---|---|---|
| YouTube | **Não é possível** | API pública de qualidade removida |
| Vimeo | **Parcial e condicionado** | `max_quality` / `setQuality()`, dependente do plano de quem subiu o vídeo |
| HLS (`.m3u8` via hls.js) | **Sim, completo** | `hls.autoLevelCapping` |
| `.mp4`/`.webm` progressivo | **Não é possível no client** | não existem renditions alternativas |

#### YouTube — não é achievable pela API pública

Verificado na referência oficial da IFrame Player API: *"The `getPlaybackQuality`,
`setPlaybackQuality`, and `getAvailableQualityLevels` functions are no longer supported"*, e as
funções de fila (`loadVideoById`, `cueVideoById`, etc.) *"no longer support the `suggestedQuality`
argument… If `suggestedQuality` is specified, it will be ignored"* — ignorado silenciosamente, sem
warning nem erro. O histórico de revisões data a documentação dessa remoção em **24/10/2019**,
registrando que a mudança já estava em vigor havia mais de um ano; `setPlaybackQualityRange`
desapareceu junto e não consta mais da referência. O único resquício é o evento
`onPlaybackQualityChange`, que continua existindo mas é apenas um sinal de leitura — e como
`getPlaybackQuality` também foi removido, nem exibir a qualidade atual é contrato garantido.

O parâmetro de URL `vq` **não** consta da lista de parâmetros suportados (a página documenta
`autoplay`, `cc_lang_pref`, `cc_load_policy`, `color`, `controls`, `disablekb`, `enablejsapi`,
`end`, `fs`, `hl`, `iv_load_policy`, `list`, `listType`, `loop`, `modestbranding`, `origin`,
`playlist`, `playsinline`, `rel`, `start`, `widget_referrer` — e marca `modestbranding`,
`showinfo`, `autohide` e `theme` como depreciados e sem efeito). Não há parâmetro de qualidade.

**Veredito: "sempre limitar embeds do YouTube a 720p" não é alcançável.** Não implementar chamada
alguma de `setPlaybackQuality*` nem passar `suggestedQuality`/`vq` — seria código morto que dá falsa
sensação de estar funcionando. Se o app precisar comunicar isso, é na UI ("a qualidade do YouTube é
decidida pelo YouTube"), não em código. Existe folclore de que o tamanho renderizado do iframe
influencia a escolha do ABR do YouTube; **não verificado documentalmente**, colide frontalmente com
tela cheia, e não deve ser tratado como mecanismo.

Fontes: [IFrame Player API
Reference](https://developers.google.com/youtube/iframe_api_reference) ·
[Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)

#### Vimeo — parcial, e o gate é o plano de quem subiu o vídeo

O SDK instalado (`@vimeo/player@2.30.4`) expõe, em `node_modules/@vimeo/player/types/player.d.ts`:

```ts
getQualities(): Promise<VimeoQuality[]>;              // :130 — { label, id, active }[]
getQuality(): Promise<VideoQualityId>;                // :135
setQuality(quality: VideoQualityId): Promise<VimeoQuality>; // :141
```

com a nota, na própria documentação do tipo: *"available to Plus, PRO and Business accounts"* e
`@throws {TypeError} If the specified quality is not available`. As opções de embed aceitas pelo
construtor incluem (`node_modules/@vimeo/player/dist/player.es.js:818` e
`types/formats.ts`): `quality`, `initial_quality`, `max_quality`, `min_quality`,
`quality_selector`. `max_quality` é descrito nos tipos instalados como *"The highest possible
quality that the player automatically switches to during video playback"* — semântica de **teto**,
que é exatamente o que se quer (mantém o ABR vivo abaixo do limite, em vez de fixar).

Ressalvas importantes, todas verificadas:

- O gate de plano é do **dono do vídeo**, não nosso. Como a sala embeda link de terceiro arbitrário,
  o teto vai funcionar em alguns vídeos e ser ignorado em outros. Não há como saber antes de tentar.
- A Central de Ajuda da Vimeo documenta o parâmetro `quality` (*"This feature requires a paid plan
  on Vimeo"*, valores `4K`, `2K`, `1080p`, `720p`, `540p`, `360p`, `240p`) mas **não** documenta
  `max_quality`/`min_quality` — esses só aparecem no SDK instalado. Tratar `max_quality` como
  best-effort, nunca como contrato.
- `quality: '720p'` **fixa** a qualidade em vez de limitar: desliga o ABR e pode *piorar* o
  travamento em rede ruim (o player deixa de poder cair pra 360p). Preferir `max_quality`.
- Se a qualidade pedida não existir no vídeo, o parâmetro é ignorado e o player volta pra `auto`;
  `setQuality()` rejeita (`TypeError`).

**Implementação especificada** (`hooks/useVimeoSync.ts`):

1. Linha 91 — construir com o teto: `new Player(container, { id: videoId, controls: false,
   max_quality: "720p" })`.
2. Depois de `player.ready()` (`:98`), reforço best-effort: `getQualities()` → escolher o maior id
   com altura ≤ 720 → `setQuality(id)`, tudo em `.catch(() => {})`. **Obrigatoriamente silencioso**:
   rejeitar em vídeo de conta free é o caso comum, não um erro a exibir; não pode cair no `setError`
   do hook.
3. Depois de `loadVideo(videoId)` (`:79`, troca de vídeo sem recriar o player), reaplicar o passo 2
   — não está verificado se as opções de embed do construtor sobrevivem a um `loadVideo`.

Fontes: [player.js README](https://github.com/vimeo/player.js) ·
[Set a default quality for embedded
videos](https://help.vimeo.com/hc/en-us/articles/12426487034641-Set-a-default-quality-for-embedded-videos)
· [Player SDK: Embed Options](https://developer.vimeo.com/player/sdk/embed)

#### HLS (`.m3u8` via hls.js) — possível e completo

Único caso em que o teto é real e determinístico. API conferida em
`node_modules/hls.js/dist/hls.js.d.ts` da versão instalada (`hls.js@1.7.1`):

- `set autoLevelCapping(newLevel: number)` / `get autoLevelCapping(): number` (`:2125`, `:2140`) —
  *"Capping/max level value that should be used by automatic level selection algorithm
  (`ABRController`)"*. É o mecanismo certo: o ABR continua funcionando, só nunca escolhe acima do
  índice informado. `get maxAutoLevel()` (`:2158`) reflete o teto em vigor.
- `get levels(): Level[]` — cada `Level` expõe `height`, `width`, `bitrate` (`:3077-3086`).
- Padrões verificados no bundle instalado (`dist/hls.mjs`): `capLevelToPlayerSize: false`
  (`:38053`), `autoLevelCapping` inicializado em `-1` (`:40044`, sem teto), `startLevel: undefined`
  (`:38122`).

**Implementação especificada** (`hooks/useNativeVideoSync.ts:98-108`), entre `new Hls()` e
`hls.loadSource(url)`:

```ts
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  // maior nível com altura <= 720; -1 (auto, sem teto) se nenhum couber
  const cap = hls.levels.reduce(
    (best, lvl, i) =>
      lvl.height <= 720 && (best < 0 || lvl.height > hls.levels[best].height) ? i : best,
    -1,
  );
  hls.autoLevelCapping = cap;
});
```

Registrar o handler **antes** de `loadSource` — `MANIFEST_PARSED` dispara antes da escolha do
primeiro fragmento, então o teto já vale no primeiro segmento, sem precisar mexer em `startLevel`.

O que **não** usar, e por quê (justificativa nos próprios docs dos tipos instalados):

- `hls.currentLevel = i` (`:2058`) — *"will flush the current buffer… playback will interrupt at
  least shortly to re-buffer"*. Introduz exatamente o engasgo que esta rodada quer eliminar.
- `hls.nextLevel` / `hls.loadLevel` (`:2069`, `:2080`) — colocam o player em modo manual e desligam o
  ABR: em rede ruim ele perde a capacidade de cair de qualidade. `autoLevelCapping` preserva o ABR.
- `config.capLevelToPlayerSize: true` (`:776`) — limita pelo **tamanho renderizado**, não por altura
  absoluta. Em tela cheia isso *sobe* o teto efetivo, ou seja, faz o oposto do pedido. Pode
  coexistir como heurística, mas não é o mecanismo do 720p.
- Se nenhum nível tiver altura ≤ 720, manter `-1` (auto). Forçar o menor nível disponível degradaria
  o vídeo sem necessidade.

#### `.mp4`/`.webm` progressivo — não é possível no client

Um arquivo progressivo é **uma** rendition: o `<video>` baixa aquele arquivo e nada mais. Não existe
manifesto, não existe lista de variantes, e o `HTMLVideoElement` não expõe API alguma de qualidade —
não há o que "limitar". Definir `width`/`height` no elemento só muda o tamanho de exibição; a
decodificação continua na resolução nativa do arquivo, então nem o custo de CPU cai.

**Veredito: "cap a 720p" não se aplica a `DIRECT_MEDIA` não-HLS.** A única solução real é
server-side — transcodificar pra 720p ou servir uma variante adaptativa (HLS/DASH) —, o que exige
pipeline de mídia própria e está fora do escopo (a seção 7 já estabelece que o app não faz proxy nem
processamento de conteúdo de terceiro). Se um `.mp4` de 1080p/4K travar, o caminho honesto é dizer
isso na UI, não fingir um controle que não existe.

### 9.5 Ordem de implementação sugerida

1. 9.1 + 9.2 (layout e botão) — puramente visual, sem risco de regressão de sync, e é o que o
   usuário vê primeiro.
2. 9.3 item 5 (`invisible` em vez de só `opacity-0`, tirar `backdrop-blur` de cima do vídeo) — barato
   e já vem junto de 9.2.
3. 9.4 HLS (`autoLevelCapping`) + Vimeo (`max_quality`) — pequenos, isolados em um hook cada.
4. 9.3 item 2 (arquitetura de re-render) — o maior e o mais arriscado; mexe em como o estado do
   player é distribuído. Fazer com medição antes/depois no Profiler, não no olho.
5. 9.3 itens 3 e 4 (drift/cooldown) — só depois de instrumentar e confirmar com log real quantas
   correções por minuto acontecem numa sessão que "laga". Mexer em sync sem medição é trocar um bug
   por outro.

### 9.6 Addendum pós-implementação: moldura em tela cheia e chat que zerava

Rodada de ajuste depois de 9.1–9.5 estarem no ar, motivada por dois prints do usuário em tela cheia
e um relato de bug funcional.

**Moldura de sync (`SyncRing`) desligada em tela cheia.** Fora de tela cheia a borda/brilho/flash de
`SyncRing.tsx` sinaliza estado da sala num contexto onde o vídeo divide tela com chat/presença. Em
tela cheia esse contexto já não existe — o vídeo *é* a tela, com o respiro próprio da 9.1 — e a
moldura passa a ser só chrome supérfluo ao redor da imagem. `SyncRing` ganhou a prop `isFullscreen`
(passada de `RoomExperience.tsx`); com ela `true`, a borda, o `animate-sync-pulse` e o flash de
`animate-sync-flash` não são aplicados — só o `<div>` estrutural (`relative rounded-lg`) permanece,
sem nenhuma cor/brilho. O badge "sync limitado" (`GENERIC_IFRAME`) continua aparecendo mesmo em tela
cheia: é informação (controle manual necessário), não decoração.

**Brilho tênue nos cantos fora de tela cheia — comportamento esperado do `box-shadow`, não bug.**
`.animate-sync-pulse` (`app/globals.css:46`) é `box-shadow: 0 0 14px 1px rgba(255,255,255,0.22)`
sem spread negativo nem segunda camada. Um `box-shadow` acompanha o `border-radius` do próprio
elemento (`rounded-lg`), então nas bordas retas o brilho se espalha uniformemente perpendicular à
aresta; no arco do canto, a mesma quantidade de luz se distribui ao longo de uma curva mais curta,
lida visualmente como mais fraca ali — é falloff gaussiano padrão do algoritmo de blur do
`box-shadow`, replicável em qualquer elemento com `border-radius` + `box-shadow`, não uma
particularidade deste componente. Não é regressão dos ajustes da seção 9 nem do fix do
`border-width` animado (item 1 da 9.3). Se um dia quiser corrigir cosmeticamente, o caminho é
reforçar especificamente os cantos (segunda camada de `box-shadow` com spread maior, ou
`filter: drop-shadow` num pseudo-elemento) — não feito nesta rodada por ser puramente estético, sem
pedido explícito de mudança visual, só a dúvida sobre normalidade.

**Bug real: mensagens de chat zeravam ao alternar fullscreen/teatro — CONFIRMADO e corrigido.**
`useChat.ts` guarda o histórico só em `useState` local (decisão travada: chat não persiste — seção
2). Antes desta rodada, `RoomExperience.tsx` renderizava o `<aside>` (e portanto `<Chat>`, e portanto
`useChat`) condicionalmente: `{showAside && (<aside>...)}`. Toda vez que `showAside` virava `false`
— entrar em tela cheia sem teatro — React desmontava `<Chat>` de verdade, destruindo o estado do
hook; ao `showAside` voltar a `true` — ligar o teatro dentro da tela cheia, ou sair da tela cheia —
`<Chat>` remontava do zero, com `useChat` reinicializando `messages` em `[]`. Sintoma relatado:
histórico sumindo tanto ao abrir o chat lateral dentro da tela cheia quanto ao digitar em tela cheia
e sair dela.

Correção: `<aside>` agora é **sempre montado**; a visibilidade que antes era renderização
condicional virou só troca de classe (`showAside ? "flex" : "hidden"`, `display:none` via Tailwind
`hidden`). `Chat`/`useChat` nunca mais desmontam por causa de fullscreen ou teatro — só o layout
(`lg:basis-[80%]`/`w-full` na coluna do vídeo, que já era baseado na mesma variável `showAside`)
continua reagindo normalmente. Efeito colateral positivo: o rascunho não-enviado no campo de
mensagem também deixa de ser perdido nesses toggles, pelo mesmo motivo.

### 9.7 Tela cheia (e modo teatro) inacessíveis em `GENERIC_IFRAME`

A 9.2 assumia que o botão de tela cheia sempre existe — mas ele mora dentro de `PlayerControls`
(`components/room/player/PlayerControls.tsx:105-116`), renderizado por `PlayerShell` só quando há um
`PlaybackController` (`{controller && (...)}`). `GENERIC_IFRAME` (iframe arbitrário de terceiro, ex.
um agregador de streaming) nunca tem controller — não existe API pra tocar/pausar/buscar um iframe
opaco de outro domínio — então `activeController` é `null` e a barra inteira, botão de tela cheia
incluso, simplesmente não renderizava. Resultado: pra essa fonte não havia nenhum caminho até tela
cheia e, por consequência, nenhum até o modo teatro/botão de teatro da 9.2 — o "abrir chat" que o
usuário via em sites de referência (print, watch-party de terceiro) não tinha equivalente aqui.

Correção: `PlayerShell` ganhou a prop `showFullscreenOnly?: boolean` (passada como `hasGeneric` por
`RoomExperience.tsx`). Com `controller === null` e `showFullscreenOnly === true`, a barra inferior
(mesmo container com auto-hide de `PlayerShell.tsx`) renderiza só o botão de tela cheia — sem
play/pause/scrubber/volume, que não fazem sentido pra um iframe que a sala não controla. Uma vez em
tela cheia, o resto já funciona sem mudança nenhuma: o botão de teatro (`RoomActions`, 9.2) é
agnóstico de fonte de vídeo — não depende de `PlaybackController`, só do estado `isFullscreen`/
`isTheater` de `RoomExperience`. Vídeo sem fonte nenhuma carregada (placeholder "use carregar
vídeo...") continua sem botão de tela cheia — `showFullscreenOnly` só é `true` quando `hasGeneric`,
não pra ausência de vídeo.

---

## 10. Auditoria UI/UX (achados e correções)

Rodada motivada por um pedido do usuário de rodar um agente focado em UI/UX no projeto inteiro.
Sem um subagente dedicado disponível na sessão no momento, a auditoria rodou via agente
general-purpose com a skill `frontend-design` carregada como lente de crítica, lendo o SPEC.md
inteiro como fonte de intenção e o código real de todos os componentes de sala/auth/player. Nove
achados, priorizados; o usuário pediu pra corrigir todos, exceto o de prioridade baixa sobre o
conjunto de emojis de reação (decisão explícita do próprio usuário numa rodada anterior — não é
bug, não foi alterado).

**1. Alvos de toque abaixo do piso de 44px da seção 8 — corrigido.** Violado em
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
A fórmula de altura máxima do vídeo em tela cheia (9.1) assume as duas colunas lado a lado; abaixo
de `lg` o stage vira `flex-col` e o vídeo (`flex-1`) disputa altura com o `aside` no mesmo eixo, sem
a fórmula descontar o espaço do aside — o chat ficava espremido a uma fresta ou cortado pelo
`overflow-hidden` do stage. Como o botão de teatro (`RoomActions.tsx`) não tinha nenhuma
condição de viewport, um usuário de mouse com a janela mais estreita que `lg` (não só toque em
celular) conseguia alcançar essa combinação quebrada. Correção: o botão de teatro ganhou
`hidden lg:flex` — só existe como alvo clicável em `lg` (1024px) pra cima, em qualquer dispositivo.
Não muda o comportamento em telas largas; fecha a única porta pra esse estado inválido. Consistente
com a seção 8: "mobile — coluna única... chat/presence colapsam abaixo, nunca disputam espaço com
o player" — em tela estreita, tela cheia já era pra ser só vídeo mesmo.

**5. Estado vazio do player sem tipografia de "Display" — corrigido.** A seção 8 reserva o papel
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
usuário numa rodada anterior desta mesma sessão (referência de watch-party de terceiro, ver seção
"Decisões travadas" / histórico da sala). A auditoria sinalizou como possível ruído de affordance,
mas mudar exigiria contradizer uma escolha explícita já feita — fica registrado aqui como
avaliado-e-mantido, não como pendência.
