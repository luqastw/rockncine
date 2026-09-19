-- Índice para a query "suas salas" (filtra por userId, ordena por joinedAt) e
-- ações de FK explícitas na tabela de junção.
--
-- O `@@unique([roomId, userId])` não serve para essa query: `roomId` é a coluna
-- líder do índice, então `WHERE userId = ? ORDER BY joinedAt DESC` varria a tabela.
--
-- `Room_code_idx` era redundante com o índice único criado pelo `@unique` da
-- coluna `code` — havia dois índices sobre a mesma coluna.

-- DropIndex
DROP INDEX "Room_code_idx";

-- CreateIndex
CREATE INDEX "RoomMember_userId_joinedAt_idx" ON "RoomMember"("userId", "joinedAt");

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_roomId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_userId_fkey";

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
