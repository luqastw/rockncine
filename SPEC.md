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
    source: "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME" | null;
    embedUrl: string | null;   // videoId (YouTube/Vimeo) ou iframe src genérico
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
  | { type: "LOAD_VIDEO"; source: "YOUTUBE" | "VIMEO" | "GENERIC_IFRAME"; embedUrl: string; sourceUrl: string; actorId: string; ts: number }
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

**Importante:** `PLAY`/`PAUSE`/`SEEK` só têm efeito real para `source: "YOUTUBE"` ou `"VIMEO"` — ver seção 7 sobre por quê.

### Drift correction

- Cada cliente roda um `setInterval` (ex. a cada 3s) comparando `player.getCurrentTime()` local com `storage.player.currentTime + (Date.now() - storage.player.updatedAt) / 1000` (se `isPlaying`).
- Se `|diff| > 1.5s`, força `seekTo(expected)` local. Não gera novo broadcast — é correção silenciosa, não uma ação de usuário.
- Só roda para `source: "YOUTUBE"` ou `"VIMEO"` — sem API de player exposta (caso `GENERIC_IFRAME`), não há `getCurrentTime`/`seekTo` pra chamar.

### Presence (por conexão, `useMyPresence` / `useOthers`)

```ts
type Presence = {
  userId: string;
  name: string;
  isMuted: boolean;   // só exibição — mute em si é local, nunca sincroniza áudio
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
3. **Chat** — broadcast `CHAT_MESSAGE`, lista local reconstituída por sessão, indicador de mute (local, refletido só em `Presence.isMuted` pra exibição).
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

---

## 7. Fontes de vídeo suportadas e limites técnicos

### Detecção de fonte (server-side, `POST /api/resolve-embed`)

Recebe `{ url: string }`, retorna `{ source, embedUrl, sourceUrl }` ou erro. Roda no servidor (não no client) pra evitar CORS na consulta de oEmbed e pra não deixar o client decidir sozinho que conteúdo remoto processar.

1. URL bate com padrão do YouTube (`youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/`) → extrai `videoId`, `source: YOUTUBE`. Client monta `https://www.youtube.com/embed/{id}` via IFrame API.
2. URL bate com padrão do Vimeo (`vimeo.com/{id}`) → resolve via oEmbed público do Vimeo (`https://vimeo.com/api/oembed.json?url=...`), extrai o `videoId` do `iframe src` retornado, `source: VIMEO`.
3. URL bate com padrão do Google Drive (`drive.google.com/file/d/{id}/view`, `/open?id={id}`, ou já `/preview`) → extrai `{id}` por regex e monta `embedUrl = https://drive.google.com/file/d/{id}/preview`. Necessário porque o link de compartilhamento padrão (`/view`) não é embutível — só a variante `/preview` libera `frame-ancestors`. `source: GENERIC_IFRAME` (Drive não expõe API de controle via `postMessage`, então cai no mesmo nível de sync do item 4 — só `LOAD_VIDEO`).
4. Qualquer outra URL → tratada como `GENERIC_IFRAME`: `embedUrl` = a própria URL colada, usada direto como `iframe src`. Sem scraping de HTML, sem oEmbed discovery genérico no MVP — o usuário cola o link que já é o player embutível (uma URL de `.../player.html?...`, por exemplo), não a página do site. Cobre "qualquer link com vídeo" como fallback universal — cada novo padrão conhecido (como Drive acima) só ganha um passo próprio na lista quando precisa de transformação de URL pra funcionar num iframe; senão o fallback genérico já resolve.

### Por que YouTube e Vimeo sincronizam e o resto não

YouTube (IFrame Player API) e Vimeo (Player SDK) expõem uma API JS baseada em `postMessage` que o parent (nosso app) chama pra controlar o player dentro do iframe, mesmo sendo cross-origin — é assim que `play()`/`pause()`/`seekTo()`/`getCurrentTime()` funcionam nesses dois casos.

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

---

## 8. Direção visual (dark, minimalista)

Princípio geral: o vídeo é o objeto — a UI existe pra sumir ao redor dele, como uma sala escura em volta de uma tela. Nada de decoração que compita com o player.

### Paleta (dark-first, um único acento)

| Token | Hex | Uso |
|---|---|---|
| `--bg-void` | `#0A0C10` | fundo base — quase preto, leve subtom frio |
| `--bg-surface` | `#14171E` | painéis: chat, sidebar de presence, modais |
| `--line` | `#262A35` | divisores e bordas, sempre discretos |
| `--ink` | `#E8E9ED` | texto primário — branco suave, não `#FFF` puro (reduz halo/glare em ambiente escuro) |
| `--ink-muted` | `#868A9B` | metadados: timestamps, nomes secundários, placeholders |
| `--ember` | `#FF8A3D` | **único** acento — live/sincronizado, CTA primário, foco, presença ativa |

Um acento só, usado com disciplina — se tudo vira `--ember`, nada é `--ember`. Reservar pra: estado "ao vivo", botão de ação primária, anel de foco, indicador de presença ativa.

### Tipografia (3 papéis)

- **Display** — grotesk geométrico, tracking apertado. Só em momentos grandes: título da sala, estados vazios ("nenhuma sala ainda"). Nunca em texto de corpo — é pra pontuar, não pra preencher.
- **Corpo** — sans humanista, legível em tamanho pequeno (chat é denso). É a fonte de 90% da UI: mensagens, labels, botões, formulários.
- **Utilitária (mono)** — pra código da sala, timestamp do chat, e qualquer diagnóstico de sync (`currentTime`, drift em ms). Mono aqui não é estética — é funcional: elimina ambiguidade `0`/`O`, `1`/`l` num código que a pessoa vai ditar ou colar pro amigo entrar na sala.

### Assinatura visual: anel de sync ao redor do vídeo

Uma borda fina em `--ember` ao redor do frame do vídeo, com pulso lento e ambiente enquanto a sala está `isPlaying`. A cada evento `LOAD_VIDEO`/`PLAY`/`PAUSE`/`SEEK` recebido de qualquer participante (seção 2), o anel dá um flash breve — um eco visual real do broadcast, não um efeito decorativo solto.

Quando `source === "GENERIC_IFRAME"` (seção 7), o anel fica estático/apagado em vez de pulsar — reforça visualmente, sem precisar de texto, que aquela sala não tem sync de play/pause real. Um elemento, dois estados, comunicando um fato técnico verdadeiro do sistema — não decoração.

### Layout

Desktop — vídeo domina, chat e presence são periféricos e quietos:

```
┌─────────────────────────────────────────────┬───────────────┐
│                                               │  presence     │
│                                               │  ● ● ●   3    │
│          ╭─────────────────────╮             ├───────────────┤
│          │                     │             │  chat         │
│          │   [ vídeo, ~72% ]   │             │  ...          │
│          │                     │             │  ...          │
│          ╰─────────────────────╯             │  ...          │
│  ● ao vivo · sincronizado        00:12:34    ├───────────────┤
│                                               │  [ mensagem ] │
└─────────────────────────────────────────────┴───────────────┘
```

Mobile — coluna única, vídeo sempre primeiro; chat/presence colapsam abaixo (aba ou bottom sheet), nunca disputam espaço com o player.

### Piso de qualidade (não negociável, independe de tema)

- Contraste `--ink` sobre `--bg-void` e `--bg-surface` dentro de AA pra texto de corpo.
- Todo elemento interativo tem estado de foco visível (`outline` em `--ember`), inclusive em navegação por teclado.
- `prefers-reduced-motion` desliga o pulso do anel de sync e qualquer transição não-essencial — vira só o flash instantâneo de estado, sem animação contínua.
- Alvos de toque em mobile ≥ 44px (chat, botões de mute/entrar na sala) — sala é usada por 2 pessoas, muitas vezes em celular deitado no sofá, não em mesa com mouse.
