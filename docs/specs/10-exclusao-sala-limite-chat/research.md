# Pesquisa — o que foi lido no codebase

Registro curto do que a exploração confirmou antes de planejar. Só o que o plano usa.

## Estado do código hoje

- **Não existe nenhuma forma de excluir sala.** Grep por `delete`/`deleteMany` em `app/`,
  `components/`, `hooks/`, `lib/` não retorna operação de escrita destrutiva. Não há rota com
  `export async function DELETE`.
- **`app/rooms/page.tsx`** é server component, lê as memberships por `userId` com
  `orderBy: { joinedAt: "desc" }, take: 20`, e seleciona `room.ownerId`. Renderiza
  `<ul>` → `<li>` → `<Link>` com nome, código e a marcação `sua · DD/MM` quando
  `room.ownerId === userId`. Ou seja: o dado de propriedade que `FR-001` precisa já está na tela.
- **`hooks/useChat.ts`** tem `MAX_MESSAGES = 200`, aplicado como `[...prev, event].slice(-MAX)`, e
  mantém `seenIdsRef: Set<string>` para deduplicar. O índice já é reconstruído a partir dos itens
  retidos quando o corte acontece — é o que faz `FR-016`/`FR-018` serem verdadeiros sem reescrita.
  O feed mistura `ChatEvent` e `SystemEvent` num único array, que é o que torna `FR-017` uma
  decisão real (e não um detalhe).
- **`components/room/player/LoadVideoModal.tsx`** é o precedente de dialog do repo: overlay
  `fixed inset-0 z-50` com `bg-[var(--scrim)]`, painel com `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, trap de Tab manual (cicla primeiro/último focável), Escape e `mousedown` no
  overlay, `triggerRef` que devolve o foco ao fechar, e `onCloseRef` para não re-inscrever o
  listener quando o pai re-renderiza. **É o formato que o `ConfirmDialog` copia.**
- **Padrão de rota com param dinâmico**: `app/rooms/[code]/video/route.ts` declara
  `{ params }: { params: Promise<{ code: string }> }` e faz `await params`. É o mesmo formato que o
  handler `DELETE` precisa (Next 15+).
- **Busca de sala tolerante a caixa**: o padrão vigente é
  `where: { OR: [{ code }, { code: code.toUpperCase() }] }`. `lib/rooms.ts` expõe
  `getRoomByCode` com `cache()`, mas ele **não devolve `ownerId`** — a checagem de dono precisa da
  coluna, então a rota faz a própria consulta.
- **Padrão de erro de rota**: `{ error: string }` via `NextResponse.json`, com `401` "não
  autenticado.", `403` "não é membro desta sala.", `404` "sala não encontrada." — o handler novo
  segue a mesma forma, trocando a mensagem do `403` para o caso de não-dono.
- **Rate limit** existe em `lib/rate-limit.ts` (em memória) e é aplicado em `register`,
  `resolve-embed` e no login. **Decisão: não aplicar na exclusão** — não estava nos requisitos
  aprovados, e uma operação destrutiva autenticada e restrita ao dono não é vetor de força bruta.
  Fica registrado aqui como decisão consciente, não como esquecimento.
- **Schema (depois da sessão anterior, ainda não aplicado no banco)**: `Room.code` é `@unique`;
  `RoomMember` tem `@@unique([roomId, userId])` e `@@index([userId, joinedAt])`; as relações de
  `RoomMember` têm `onDelete: Cascade` no arquivo, e `Room.owner` tem `onDelete: Restrict`.

## Conclusão

A feature é pequena e não exige schema novo. O único ponto que exigiu decisão foi a dependência
do cascade não aplicado (resolvido com transação explícita, em `plan.md` §2.1). O resto é seguir
três padrões que já existem no repo: rota com `params` assíncrono, dialog com trap de foco, e
query tolerante a caixa.
