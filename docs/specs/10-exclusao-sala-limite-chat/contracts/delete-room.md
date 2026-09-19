# Contrato — `DELETE /api/rooms/[code]`

Implementa `FR-008` a `FR-012`. Corpo de erro é sempre `{ error: string }` e nunca contém nome,
dono ou qualquer outro dado da sala.

## Requisição

```
DELETE /api/rooms/{code}
Cookie: next-auth.session-token=...        (sessão JWT do NextAuth)
Origin: <origem do browser>                (opcional; enviado em requisições cross-origin)
```

- `{code}` é o código da sala (8 caracteres, `lib/room-code.ts`). O servidor aceita o código em
  qualquer caixa (mesmo padrão de `app/rooms/[code]/layout.tsx`: igualdade exata em duas
  comparações, nunca `ILIKE`).
- Sem corpo de requisição. Se um corpo for enviado, é ignorado.
- Único método suportado: `DELETE`. Outros métodos nessa rota respondem `405` pelo próprio Next.

## Respostas

| Status | Condição | Corpo | Efeito no banco |
|---|---|---|---|
| `200` | solicitante autenticado é o dono e a sala existe | `{ "ok": true }` | `RoomMember` da sala + `Room` removidos (transação) |
| `401` | sem sessão válida | `{ "error": "não autenticado." }` | nenhum |
| `403` | autenticado, mas `room.ownerId !== session.user.id` | `{ "error": "só o dono pode excluir esta sala." }` | nenhum |
| `403` | `Origin` presente com host diferente do host da requisição | `{ "error": "origem não permitida." }` | nenhum |
| `404` | sala não encontrada para o `code` | `{ "error": "sala não encontrada." }` | nenhum |

Ordem das verificações: `Origin` → sessão → existência da sala → propriedade. Assim uma origem
não permitida nunca chega a revelar se a sala existe.

## Exemplos

**Sucesso**

```
DELETE /api/rooms/7KQ2M9XA
→ 200
{ "ok": true }
```

**Não é o dono**

```
DELETE /api/rooms/7KQ2M9XA      (sessão de outro usuário)
→ 403
{ "error": "só o dono pode excluir esta sala." }
```

**Repetição após sucesso (idempotência observável)**

```
DELETE /api/rooms/7KQ2M9XA      (mesma sessão do dono, sala já removida)
→ 404
{ "error": "sala não encontrada." }
```

## Efeitos colaterais observáveis

- A lista de `/rooms` daquele usuário deixa de conter a sala na próxima renderização
  (`router.refresh()` após o `200`).
- Demais participantes que estejam **dentro** da sala não são afetados nesta versão: a sala do
  Liveblocks continua existindo até todos saírem, e a exclusão do registro no banco não derruba a
  sessão ativa de ninguém. Sair e tentar entrar de novo resulta em `404`. Este comportamento é
  consequência de "não apagar a sala no Liveblocks" (não-objetivo registrado no `spec.md`).
- Não há emissão de evento, e-mail, log de auditoria ou webhook.

## Não faz parte do contrato

- Paginação ou exclusão em lote — apenas uma sala por requisição.
- Rate limit dedicado — ver `research.md` para a decisão registrada.
- `If-Match`/ETag ou qualquer controle de concorrência otimista — ver `spec.md` §8 (risco de
  concorrência) e AC-007.
