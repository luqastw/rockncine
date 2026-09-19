# Spec: consistência de design

**Status:** implementado (com ressalvas)
**Pesquisa:** `research.md`

## 1. Problema / motivação

Depois de várias rodadas de correções pontuais escritas por agentes diferentes, o design acumulou
divergências. Esta revisão não buscou achados isolados: verificou se o design ficou padronizado. Os
quatro componentes que o pedido citava como suspeitos (`InviteCode`, `LastActionNote`,
`CreateRoomForm`, `SignOutButton`) não eram o problema; a divergência real estava nas telas de
auth/404 e no card de sala de `app/rooms/page.tsx`. Catorze achados, que esta rodada corrigiu.

## 2. Objetivos e não-objetivos

**Objetivos**

1. Fazer o 404 específico de sala renderizar de fato.
2. Unificar o papel Display dos `h1`, o contraste de contorno e os anéis de foco.
3. Trocar valores literais repetidos por tokens (`--scrim`, `--focus-offset`) e devolver a escala
   tipográfica a `xs/sm/base/lg/xl/2xl`.

**Não-objetivos**

- Decidir a diferença de `text-xs`/`text-sm` entre botões-fantasma dentro e fora da sala: registrada
  como defensável (densidade de chrome de sala) e não alterada, por exigir julgamento visual.
- Redesenhar componentes ou telas.
- Alterar comportamento de produto além do roteamento do 404.
- Trocar a família tipográfica — Display segue sendo peso, tamanho e tracking sobre a mesma sans.

## 3. Histórias de usuário

- **US-1**: Como quem digita uma sala inexistente, quero ver o 404 específico de sala.
- **US-2**: Como usuário passando por telas consecutivas (login, 404, sala), quero títulos e
  contornos consistentes.
- **US-3**: Como quem navega por teclado, quero o mesmo anel de foco nos mesmos tipos de controle.

## 4. Requisitos funcionais (EARS)

- **FR-001** QUANDO a sala não existir, o `page.tsx` de `/rooms/[code]` DEVE chamar `notFound()`, e o
  `layout.tsx` NÃO DEVE chamá-lo. (achado 1)
- **FR-002** SE a sala não existir, ENTÃO o `layout.tsx` DEVE pular o `upsert` de `RoomMember`.
  (achado 1)
- **FR-003** Todos os `h1` DEVEM usar o papel Display (`font-semibold tracking-tight`), sem família
  tipográfica nova. (achado 2)
- **FR-004** Os contornos de controle DEVEM usar `--ink-muted` no repouso e ir para `--ink` no
  hover. (achado 3)
- **FR-005** Os links inline DEVEM usar `focus:ring-2` com `--outline-strong`. (achado 4)
- **FR-006** Os overlays DEVEM usar o token `--scrim`; `bg-black` literal fica reservado à letterbox
  do vídeo. (achado 5)
- **FR-007** O bloco de erro do `PlayerLoadStatus` DEVE ter `role="alert"` e o mesmo padding dos
  demais blocos de erro. (achado 5)
- **FR-008** O código de convite DEVE usar `font-mono text-sm tracking-wider` nos três pontos que o
  exibem. (achado 5)
- **FR-009** O `aside` do chat DEVE usar `gap-3` entre título e conteúdo. (achado 5)
- **FR-010** Todo `ring-offset` DEVE usar o token `--focus-offset`. (achado 5)
- **FR-011** O anel de foco do overlay de pausa DEVE ser `ring-2` em `focus-visible`, mantendo
  `ring-inset`. (achado 5)
- **FR-012** As mensagens de erro DEVEM começar com letra minúscula. (achado 5)
- **FR-013** O badge "ao vivo" DEVE usar `text-xs`. (achado 5)
- **FR-014** Os comentários que citam valores de layout DEVEM espelhar o valor vigente. (achado 5)

## 5. Critérios de aceite (Given-When-Then)

Um `When` por cenário.

- **AC-001** [FR-001] Given o usuário logado, When `/rooms/ZZZZZZZZ` é aberto em browser real, Then o
  DOM contém o texto do `app/rooms/[code]/not-found.tsx` e não o do 404 genérico.
- **AC-002** [FR-002] Given uma sala inexistente, When o `layout.tsx` roda, Then nenhuma linha de
  `RoomMember` é criada.
- **AC-003** [FR-003] Given `/login`, `/register`, os dois `not-found`, `/rooms` e `app/error.tsx`,
  When os `h1` são medidos, Then todos têm o mesmo `font-weight` e o mesmo `letter-spacing`.
- **AC-004** [FR-004] Given o card de "suas salas", When a borda é medida sobre `--bg-void`, Then o
  repouso é `--ink-muted` e o hover é `--ink`.
- **AC-005** [FR-005] Given os links "abrir em nova aba" e "abrir o link original", When focados,
  Then exibem `ring-2` com `--outline-strong`.
- **AC-006** [FR-006] Given o modal e o `PlayerLoadStatus`, When os overlays são inspecionados, Then
  ambos usam `var(--scrim)`.
- **AC-007** [FR-007] Given um erro do player, When o bloco é renderizado, Then tem `role="alert"` e
  o padding igual ao dos outros blocos de erro.
- **AC-008** [FR-008] Given os três lugares que exibem o código de convite, When as classes são
  inspecionadas, Then todas incluem `font-mono text-sm tracking-wider`.
- **AC-009** [FR-009] Given o `aside` do chat, When o gap entre título e conteúdo é medido, Then é
  `0.75rem` (`gap-3`).
- **AC-010** [FR-010] Given qualquer `ring-offset` do projeto, When a classe é inspecionada, Then usa
  `--focus-offset` (0 ocorrências de `--bg-void` hardcoded nesse uso).
- **AC-011** [FR-011] Given o overlay de pausa do YouTube focado, When o anel é medido, Then é
  `ring-2` e `inset`.
- **AC-012** [FR-012] Given as mensagens de erro de `/api/register` e `LoginForm`, When os textos são
  lidos, Then começam com letra minúscula.
- **AC-013** [FR-013] Given o badge "ao vivo", When a classe é inspecionada, Then é `text-xs`.
- **AC-014** [FR-014] Given o comentário do `RoomExperience` sobre o teto do vídeo, When ele é lido,
  Then cita `38dvh`.

## 6. Requisitos não-funcionais (quantificados)

- **Escala tipográfica:** somente `xs/sm/base/lg/xl/2xl`; 0 usos fora da escala (o `text-[10px]` do
  badge sai) (AC-013).
- **Token de offset:** `--focus-offset` aplicado em 15 arquivos, contra 3 antes (AC-010).
- **Verificação:** `npm test` 22/22, `npx tsc --noEmit`, `npx eslint` e `npx next build` sem erro
  (AC-001 a AC-014).
- **Telas alinhadas:** 4 telas receberam o papel Display (`/login`, `/register` e os dois
  `not-found`), somando 6 `h1` no mesmo peso e tracking (AC-003).

## 7. Dados e contratos

- Tokens CSS globais em `app/globals.css`: `--scrim` (overlay) e `--focus-offset` (offset de anel,
  default `--bg-void`).
- Nenhuma entidade, campo ou endpoint novo.
- O 404 de sala passa a depender de `page.tsx` chamar `notFound()`; o `layout.tsx` do mesmo segmento
  deixa de chamá-lo e passa a só pular o `upsert` quando a sala não existe.

## 8. Riscos / dependências

- **Ressalva registrada, não decidida.** A diferença `text-xs`/`text-sm` entre botões-fantasma dentro
  (`InviteCode`, `RoomActions`) e fora (`SignOutButton`, `JoinRoomForm`) da sala foi registrada como
  defensável e não alterada.
- **Verificação parcial.** O achado 1 foi reverificado logado via browser real; os demais, por
  leitura de código (as classes mudadas não têm ambiguidade de efeito).
- **Dependência da spec 04.** Depende dos tokens criados na spec 04 (`--focus-offset`, achado 24) e
  do teto de `38dvh` (achado 9).

## Anexo A — numeração legada (âncoras citadas pelo código)

Nenhuma âncora desta spec é citada pelo código: `grep -rn "06-consistencia-design" app components
hooks lib prisma` não retorna nenhum arquivo de código.

| Âncora | Título original | Onde vive agora | Citada em |
|---|---|---|---|
| — | — | — | — |

**Observação.** `components/room/RoomExperience.tsx:431` cita "revisão de consistência, achado 5 de
`docs/specs/04-auditoria-ui-ux-rodada-2/spec.md`". O rótulo "revisão de consistência" é o título
desta spec e o conteúdo é o item "5–14" (`FR-006`), mas o caminho citado é o da spec 04 — ver a
observação no Anexo A da spec 04.
