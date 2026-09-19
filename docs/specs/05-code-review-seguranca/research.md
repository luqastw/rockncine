# Pesquisa original — Code review — bypass de autorização, injeção de conteúdo e bugs funcionais

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico do diagnóstico: medições, vereditos e código citado por linha.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Code review — bypass de autorização, injeção de conteúdo e bugs funcionais

**Status:** implementado

Pedido do usuário: revisão de código completa do projeto (`code-reviewer`, não só o diff), depois
do commit de `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`. Duas rodadas — a segunda pra verificar se a primeira rodada de correções não
introduziu regressão, e pra cobrir o que a primeira não pegou. Todos os achados foram corrigidos.

### 12.1 Primeira rodada

**1. Bypass de autorização real — CONFIRMADO, corrigido.** `app/rooms/[code]/layout.tsx` e
`page.tsx` buscavam a sala com `mode: "insensitive"` do Prisma — vira `ILIKE` no Postgres, e o
segmento de URL cru virava padrão: `GET /rooms/%` casava uma sala arbitrária, criava
`RoomMember` pra quem nunca soube o código dela, e `/api/liveblocks-auth` concedia acesso completo
(chat, presença, controle do player) a partir dessa membership recém-criada. Confirmado com query
real contra o Postgres de dev antes da correção. Corrigido pra duas igualdades exatas —
`OR: [{ code }, { code: code.toUpperCase() }] ` — cobrindo o mesmo caso de uso (código de 8
caracteres ditado em qualquer caixa, cuid antigo digitado como está) sem interpretar `%`/`_` como
curinga. Reverificado depois da correção: `%`, `A%` e `_` não casam mais nenhuma sala.

**2. Injeção de `embedUrl` — CONFIRMADO, corrigido em dois pontos.** `PATCH /rooms/[code]/video`
aceitava `source`/`embedUrl` do client sem validar (`resolveVideoUrl`, a única função que exige
protocolo `http(s)`, era importada só como tipo, nunca chamada). Um membro da sala — ou, antes do
achado 1 ser corrigido, nem precisava ser membro de verdade — podia gravar
`embedUrl: "data:text/html,<form>…"`, persistido no Postgres e injetado direto em `<iframe src>`
(`GenericIframe.tsx`) e `<a href>` (`RoomExperience.tsx`) pra todo mundo que abrisse a sala depois.
Corrigido em duas camadas: (a) o PATCH só aceita `sourceUrl` e re-deriva `source`/`embedUrl`
via `resolveVideoUrl` no servidor; (b) `isSafeEmbedUrl()` (novo, `lib/video-source.ts`) guarda
protocolo `http(s)` em todo ponto de renderização — `GenericIframe.tsx`, `RoomExperience.tsx` (link
"abrir em nova aba") e `PlayerLoadStatus.tsx` (link "abrir o link original") — como defesa em
profundidade pro caso de alguém escrever direto no storage do Liveblocks contornando a rota (a
mesma classe de escrita usada por `useLoadVideo.ts` no fluxo legítimo).

**3. Overlay de erro do player inalcançável depois de `isReady` — CONFIRMADO, corrigido (ver 12.2.A
pra regressão introduzida por esta correção).** `PlayerLoadStatus` só renderizava com `loading`
`true`; erros emitidos depois de `isReady` (autoplay bloqueado, embed restrito reportado só após
`onReady`) nunca apareciam. Trocado pra `if (!loading && !error) return null`.

**4. "entrou na sala" nunca era entregue — CONFIRMADO, corrigido.** `useRoomJoinAnnouncement`
broadcastava no `mount`, antes de o socket do Liveblocks terminar de conectar (a conexão só fecha
depois do roundtrip pra `/api/liveblocks-auth`) — `broadcastEvent` descarta em silêncio quando não
está `connected`. 0% de entrega, não intermitente; confirmado contra o código do SDK instalado.
Corrigido com `{ shouldQueueEventIfNotReady: true }`.

**5. Atalho de teclado sequestrava Ctrl+F/Cmd+F/Ctrl+K/Cmd+M — CONFIRMADO, corrigido.** O handler de
`keydown` (achado 27, `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`) não checava `ctrlKey`/`metaKey`/`altKey` antes de `preventDefault()`
em `f`/`k`/espaço — Ctrl+F matava a busca do browser e entrava em tela cheia; Cmd+M tentava minimizar
a janela no macOS. Corrigido com `if (e.ctrlKey || e.metaKey || e.altKey) return;` no topo do
handler.

**6. Zero cobertura de teste no repositório — CONFIRMADO, corrigido.** Não havia runner nem arquivo
de teste. Instalado Vitest (`npm test`), com testes pra exatamente as três categorias de risco que
motivaram o achado: parsing de URL de terceiro e o próprio vetor do achado 2
(`lib/video-source.test.ts`), aritmética de late-join/drift (`hooks/playerController.test.ts`,
cobre clamp por duração e staleness do achado 10) e o formato do código de convite do achado 6
(`lib/room-code.test.ts`). 22 testes.

### 12.2 Segunda rodada — verificação da 12.1 + achados novos

Confirmou as 6 correções da 12.1 como sólidas, sem regressão de autorização/injeção. Achou três
bugs novos, nenhum de segurança:

**A. Overlay de erro virou permanente — regressão da correção do item 3.** `if (!loading && !error)
return null` mantém o overlay vivo enquanto `error` for não-nulo, mas nenhum backend limpava `error`
na recuperação. Em `DIRECT_MEDIA`: `play()` interrompido por um `pause()` remoto chegando enquanto a
promise ainda está pendente rejeita com `AbortError` — comportamento normal do
`HTMLMediaElement`, não falha real —, e o `.catch` gravava a mesma mensagem de erro real. O vídeo
seguia tocando atrás de um overlay preso pro resto da sessão. Corrigido em
`hooks/useNativeVideoSync.ts`: `reportPlayFailure()` ignora `err.name === "AbortError"`, e
`onPlay` limpa `error` sempre que a reprodução volta a acontecer de verdade.

**B. "Tentar carregar de novo" virou no-op silencioso.** O atalho de retry
(`loadedUrlRef.current === url && videoEl.src`) não checava se o load anterior tinha dado certo —
`videoEl.src` fica truthy mesmo depois de um manifest HLS 404 ou de um `.mp4` que nunca carregou.
Colar de novo o mesmo link depois de um erro caía nesse atalho, a mensagem de erro sumia, a tela
ficava preta e nada era rebuscado. Corrigido acrescentando `isReady && !error` à condição do atalho
(`hooks/useNativeVideoSync.ts`), com `eslint-disable-next-line` explicado inline — de propósito
fora das deps do efeito, senão o load bem-sucedido reentraria no mesmo atalho e reiniciaria o vídeo
do zero.

**C. Listener `seeked` do Vimeo duplicava o broadcast de todo seek local.** O comentário em
`useVimeoSync.ts` afirmava que o listener `seeked` só reagia a eventos remotos — falso: `seek()`
chamava `player.setCurrentTime()` fora de `applyRemote`, então `isApplyingRemoteRef.current` estava
`false` durante um seek local, e o listener mandava um segundo `commit`+`broadcast` idêntico pra
cada arraste do scrubber. Sem corrupção de estado, mas dobrava o tráfego de sync e piscava o flash
do `SyncRing` duas vezes. Corrigido envolvendo `player.setCurrentTime()` em `applyRemote()` dentro
de `seek()`; o comentário desatualizado foi removido.

Verificação desta seção inteira: `npm test` (22/22), `npx tsc --noEmit` e `npx eslint` limpos depois
de cada rodada; achado 1 reverificado com query real contra o Postgres de dev.
