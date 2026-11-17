"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// POST nativo pra /rooms/new (redirect 303 no servidor) — o único motivo de
// ser client component é o estado de pendência: sem ele o clique não dava
// retorno nenhum enquanto o servidor gravava no Postgres, e dava pra clicar
// duas vezes e criar duas salas (achado 23 da auditoria).
export function CreateRoomForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/rooms/new"
      method="POST"
      onSubmit={() => setSubmitting(true)}
      className="flex gap-2"
    >
      <label htmlFor="room-name" className="sr-only">
        Nome da sala
      </label>
      <Input
        surface
        id="room-name"
        type="text"
        name="name"
        maxLength={60}
        placeholder="Nome da sala (opcional)"
        className="min-w-0 flex-1 scroll-mt-28"
      />
      <Button type="submit" disabled={submitting} className="shrink-0">
        {submitting ? "Criando..." : "Criar sala"}
      </Button>
    </form>
  );
}
