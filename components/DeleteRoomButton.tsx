"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TrashIcon } from "@/components/room/player/icons";
import { iconButtonClass } from "@/components/ui/IconButton";
import { cx } from "@/lib/cx";

// Botão de exclusão de uma sala, renderizado por linha da lista de /rooms.
// Fica por linha (e não a lista inteira) para manter `app/rooms/page.tsx` como
// server component: o cliente recebe só o código e o nome da sala.
export function DeleteRoomButton({
  roomCode,
  roomName,
  className,
}: {
  roomCode: string;
  roomName: string | null;
  className?: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = roomName?.trim() ? roomName.trim() : null;
  const description = displayName
    ? `A sala ${displayName} (código ${roomCode}) será apagada para sempre. Essa ação não pode ser desfeita.`
    : `A sala de código ${roomCode} será apagada para sempre. Essa ação não pode ser desfeita.`;

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
      setError(data?.error ?? "Não foi possível excluir a sala.");
    } catch {
      setError("Não foi possível excluir a sala. Verifique sua conexão e tente de novo.");
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
        aria-label={`Excluir sala ${displayName ?? roomCode}`}
        className={cx(
          iconButtonClass({
            variant: "outline",
            className: "shrink-0 hover:border-[var(--heart)] hover:text-[var(--heart)]",
          }),
          className,
        )}
      >
        <TrashIcon className="size-5" />
        <span className="sr-only">Excluir sala</span>
      </button>

      <ConfirmDialog
        open={open}
        title="Excluir sala"
        description={description}
        confirmLabel="Excluir sala"
        busyLabel="Excluindo..."
        busy={busy}
        error={error}
        onConfirm={confirmDelete}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
      />
    </>
  );
}
