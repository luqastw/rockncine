# Pesquisa original — Revisão de consistência de design

> Conteúdo migrado verbatim de `spec.md` em 2026-09-18, ao mover esta spec para o formato SDD.
> Registro histórico do diagnóstico: medições, vereditos e código citado por linha.
> As âncoras citadas pelo código continuam resolvendo em `spec.md` — ver Anexo A.

# Revisão de consistência de design

**Status:** implementado

Pedido do usuário depois de `docs/specs/05-code-review-seguranca/spec.md`: não uma nova auditoria de achados isolados, mas verificar se o
design ficou padronizado depois de várias rodadas de correções pontuais (`docs/specs/03-auditoria-ui-ux/spec.md`, `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`, `docs/specs/05-code-review-seguranca/spec.md`) escritas
por agentes diferentes em momentos diferentes. Rodou `ui-ux-frontend` com leitura do SPEC.md inteiro
(`docs/specs/01-fundacao-mvp/spec.md`, seção 8, como tokens canônicos) mais medição no navegador (`getComputedStyle`) contra o build de
produção com uma sessão logada. Catorze achados; todos corrigidos. Os quatro componentes que o
pedido citava como suspeitos por terem sido escritos na mesma rodada sob pressão de outra tarefa —
`InviteCode`, `LastActionNote`, `CreateRoomForm`, `SignOutButton` — não eram o problema; a
divergência real estava nas telas de auth/404 e no card de sala novo de `app/rooms/page.tsx`.

**1. `app/rooms/[code]/not-found.tsx` nunca renderizava — bug de roteamento real, corrigido.**
`notFound()` lançado dentro de um `layout.tsx` borbulha pro not-found do segmento **pai**, não pro
arquivo colocalizado no mesmo segmento — `layout.tsx` chamava `notFound()` depois de não achar a
sala, então `/rooms/ZZZZZZZZ` sempre caía no 404 genérico (`app/not-found.tsx`), nunca no específico
de sala. Confirmado no navegador antes e depois da correção, com sessão real. Corrigido: `layout.tsx`
só pula o `upsert` de `RoomMember` quando a sala não existe, sem chamar `notFound()`; `page.tsx` (que
já fazia a mesma busca) é quem chama `notFound()`, e por estar no mesmo segmento do arquivo
colocalizado, `app/rooms/[code]/not-found.tsx` passou a renderizar de verdade — reverificado logado
via browser real (não só `curl`, que não é confiável aqui: o HTML de streaming SSR embute os dois
textos possíveis serializados no payload RSC, então grep no HTML bruto não diz qual foi de fato
montado no DOM).

**2. Papel "Display" aplicado em metade dos `h1` — corrigido.** `font-semibold tracking-tight`
existia em `/rooms`, `app/error.tsx` e nos dois estados do player, mas não em `/login`, `/register`
nem nos dois `not-found`. Medido: mesma palavra ("rockncine"), mesmo tamanho, duas espessuras em
telas consecutivas do fluxo de entrada. Aplicado nos quatro arquivos restantes.

**3. Card de sala em `app/rooms/page.tsx` com borda abaixo do piso de contraste — corrigido.** A
`docs/specs/03-auditoria-ui-ux/spec.md` (item 7) e `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md` (item 12) já tinham trocado `--line` por `--ink-muted` em todo
botão/input; o `<Link>` do card de "suas salas", escrito na mesma rodada P0-P2, ficou de fora —
`border-[var(--line)]` mede 1,36:1 sobre `--bg-void`, e o hover ia pra `--ink-muted` em vez de
`--ink` como todo outro controle. Corrigido pra `border-[var(--ink-muted)] hover:border-[var(--ink)]`.

**4. Dois links inline sem anel de foco do projeto — corrigido.** "abrir em nova aba"
(`RoomExperience.tsx`) e "abrir o link original" (`PlayerLoadStatus.tsx`) eram só
`text-[var(--ink)] underline`, caindo no outline default do navegador; os links equivalentes de
`/login`/`/register` já tinham `focus:ring-2 focus:ring-[var(--outline-strong)]`. Igualados.

**5–14. Polimento — todos corrigidos.** Token `--scrim` (`app/globals.css`) substituindo dois
overlays com opacidades diferentes (`bg-black/70` no modal, `bg-black/60` no `PlayerLoadStatus`) pra
mesma função — `bg-black` literal ficou só na letterbox do vídeo, com comentário explicando que ali
é preto real, não `--bg-void`; bloco de erro de `PlayerLoadStatus` ganhou `role="alert"` e padding
igualado aos outros três blocos de erro do app; código de convite (papel "utilitária mono", `docs/specs/01-fundacao-mvp/spec.md`, seção 8)
padronizado pra `font-mono text-sm tracking-wider` nos três lugares que o exibem (`InviteCode`,
"suas salas", `JoinRoomForm`); gap entre título e conteúdo do `Chat` subiu de `gap-2` pra `gap-3`
pra bater com o resto do `aside`; token `--focus-offset` (criado no achado 24 de `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`, usado só
em 3 de 14 arquivos) generalizado pra todo `ring-offset-[var(--bg-void)]` hardcoded do projeto (15
arquivos); anel de foco do overlay de pausa do YouTube igualado ao resto (`ring-4 focus-visible` →
`ring-2 focus`, mantendo `ring-inset`); quatro mensagens de erro capitalizadas
(`app/api/register/route.ts` ×3, `LoginForm.tsx`) baixadas pra minúsculo, único padrão usado no
resto da UI; `text-[10px]` do badge "ao vivo" subiu pra `text-xs` (única fonte fora da escala
xs/sm/base/lg/xl/2xl em uso); comentário desatualizado corrigido (`RoomExperience.tsx`, "45dvh" →
"38dvh", divergia do valor real desde `docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`, item 9). Diferença de `text-xs`/`text-sm` entre
botões-fantasma de dentro e fora da sala (`InviteCode`/`RoomActions` vs. `SignOutButton`/
`JoinRoomForm`) ficou registrada no relatório da revisão como defensável (densidade de chrome de
sala) mas não decidida — não alterada nesta rodada por exigir julgamento visual, não é bug.

Verificação: `npm test` (22/22), `npx tsc --noEmit`, `npx eslint` e `npx next build` limpos; achado 1
reverificado logado via browser real, os demais por leitura de código (as classes Tailwind mudadas
não têm ambiguidade de efeito).
