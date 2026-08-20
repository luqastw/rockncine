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
      route.ts                   # POST — cria Room, redireciona pra /rooms/[code]
  rooms/[code]/
    page.tsx                     # sala: player + chat + presence (Server Component busca Room; Client Component monta LiveblocksProvider)
    layout.tsx                   # valida sessão, garante RoomMember (upsert on join)
  api/
    auth/[...nextauth]/route.ts  # NextAuth handler
    liveblocks-auth/route.ts     # endpoint de auth do Liveblocks (authorize por sessão NextAuth)
```

`middleware.ts` na raiz protege `/rooms/**` — redireciona não-autenticado pra `/login`.

---

## 4. Fluxo de autenticação (NextAuth)

- Provider: `CredentialsProvider` único. `authorize()` busca `User` por email, compara senha com `bcrypt.compare` contra `passwordHash`.
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

Serviços a provisionar antes da fase 1: projeto Postgres (Neon/Supabase) e projeto Liveblocks. Vercel só entra no deploy, não bloqueia desenvolvimento local.

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
