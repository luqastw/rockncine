"use client";

import { useState } from "react";

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
      <input
        id="room-name"
        type="text"
        name="name"
        maxLength={60}
        placeholder="nome da sala (opcional)"
        className="min-h-11 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        {submitting ? "criando..." : "nova sala"}
      </button>
    </form>
  );
}
