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
      className="flex flex-col gap-2"
    >
      <label htmlFor="room-name" className="sr-only">
        nome da sala
      </label>
      <Input
        id="room-name"
        type="text"
        name="name"
        maxLength={60}
        placeholder="nome da sala (opcional)"
      />
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "criando..." : "nova sala"}
      </Button>
    </form>
  );
}
