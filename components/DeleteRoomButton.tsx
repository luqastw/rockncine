"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// Botão de exclusão de uma sala, renderizado por linha da lista de /rooms.
// Fica por linha (e não a lista inteira) para manter `app/rooms/page.tsx` como
// server component: o cliente recebe só o código e o nome da sala.
export function DeleteRoomButton({
  roomCode,
  roomName,
}: {
  roomCode: string;
  roomName: string | null;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = roomName?.trim() ? roomName.trim() : null;
  const description = displayName
    ? `a sala ${displayName} (código ${roomCode}) será apagada para sempre. essa ação não pode ser desfeita.`
    : `a sala de código ${roomCode} será apagada para sempre. essa ação não pode ser desfeita.`;

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomCode}`, { method: "DELETE" });

      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }

      // 404 = a sala já não existe (excluída em outra aba, por exemplo).
      // Não é falha do ponto de vista de quem pediu: fecha e tira da lista,
      // sem mensagem de erro.
      if (res.status === 404) {
        setOpen(false);
        router.refresh();
        return;
      }

      const data: { error?: string } | null = await res.json().catch(() => null);
      setError(data?.error ?? "não foi possível excluir a sala.");
    } catch {
      setError("não foi possível excluir a sala. verifique sua conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={`excluir sala ${displayName ?? roomCode}`}
        className="flex min-h-11 shrink-0 items-center rounded-md border border-[var(--ink-muted)] px-3 text-xs text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
      >
        excluir sala
      </button>

      <ConfirmDialog
        open={open}
        title="excluir sala"
        description={description}
        confirmLabel="excluir sala"
        busyLabel="excluindo..."
        busy={busy}
        error={error}
        onConfirm={confirmDelete}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      />
    </>
  );
}
