# Modelo de dados — impacto da exclusão

**Nenhuma mudança de schema.** Esta feature só remove linhas existentes. O documento registra o
que a exclusão toca e o que fica dependendo de migration.

## Entidades envolvidas

### `Room` (`prisma/schema.prisma`)

| Campo | Tipo | Observação para a exclusão |
|---|---|---|
| `id` | `String @id @default(cuid())` | PK; é o alvo real do `DELETE` |
| `code` | `String @unique @default(cuid())` | usado no endpoint como identificador público |
| `name` | `String?` | exibido no modal de confirmação |
| `ownerId` | `String` | **fonte da autorização** (`FR-009`) |
| `owner` | relação → `User` | `onDelete: Restrict` — apagar `User` não apaga `Room` |
| `members` | relação → `RoomMember[]` | removidos explicitamente antes do `Room` (`FR-012`) |

### `RoomMember` (tabela de junção)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String @id @default(cuid())` | PK |
| `roomId` | `String` | FK para `Room.id` |
| `userId` | `String` | FK para `User.id` |
| `joinedAt` | `DateTime @default(now())` | ordena a lista em `/rooms` |
| — | `@@unique([roomId, userId])` | impede membership duplicada |
| — | `@@index([userId, joinedAt])` | serve a query "suas salas" |

## Como a exclusão acontece

```
DELETE /api/rooms/{code}
  1. SELECT Room WHERE code = {code} OR code = UPPER({code})   -- 1 instrução
  2. transação:
       DELETE FROM RoomMember WHERE roomId = <id>              -- instrução 2
       DELETE FROM Room WHERE id = <id>                        -- instrução 3
```

Ordem obrigatória: `RoomMember` antes de `Room`, para não depender de `ON DELETE CASCADE`.

## Migrações

- **Nenhuma migração nova.** A feature não altera schema.
- **Migração pendente e relacionada**:
  `prisma/migrations/20260918230000_room_member_index_and_fk_actions/` — cria
  `RoomMember_userId_joinedAt_idx`, troca as duas FKs de `RoomMember` para `ON DELETE CASCADE` e
  remove o índice redundante `Room_code_idx`. Existe no repositório e **não foi aplicada** no
  banco. A rota funciona sem ela; o índice de `userId` só passa a valer depois de
  `npx prisma migrate deploy`.
- Se a migration for aplicada depois, a transação explícita continua correta — só fica redundante
  com o cascade. Redundância aceita: mais barata que depender de estado do banco.

## Invariantes que a feature preserva

- Nenhuma linha órfã em `RoomMember` após a exclusão (AC-006).
- Nenhuma linha de `Room` sem `owner` correspondente — a relação é `Restrict` e a exclusão não
  toca `User`.
- O `code` de uma sala excluída pode ser reutilizado por uma sala futura (é `@unique`, mas a linha
  deixou de existir). Não há requisito de quarentena de código.
