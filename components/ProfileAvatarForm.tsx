"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { avatarSrc } from "@/lib/avatar";
import { Button, buttonClass } from "@/components/ui/Button";

const MAX_BYTES = 2_097_152;
const TOO_LARGE_MESSAGE = "Imagem muito grande (máx 2 MB).";
const NETWORK_MESSAGE = "Não foi possível enviar. Tente de novo.";

function broadcastAvatar(v: number | null) {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("rockncine:avatar");
    channel.postMessage({ v });
    channel.close();
  } catch {
    return;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    return NETWORK_MESSAGE;
  }
  return NETWORK_MESSAGE;
}

export function ProfileAvatarForm({
  userId,
  initialAvatarV,
  stacked = false,
}: {
  userId: string;
  initialAvatarV: number | null;
  stacked?: boolean;
}) {
  const [avatarV, setAvatarV] = useState<number | null>(initialAvatarV);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearSelection() {
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    if (!chosen) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (chosen.size > MAX_BYTES) {
      clearSelection();
      setError(TOO_LARGE_MESSAGE);
      return;
    }
    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function run(request: () => Promise<Response>, onSuccess: (response: Response) => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await request();
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      await onSuccess(response);
    } catch {
      setError(NETWORK_MESSAGE);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(TOO_LARGE_MESSAGE);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    await run(
      () => fetch("/api/profile/image", { method: "PUT", body }),
      async (response) => {
        const data = await response.json();
        setAvatarV(data.v);
        clearSelection();
        broadcastAvatar(data.v);
      },
    );
  }

  async function handleRemove() {
    await run(
      () => fetch("/api/profile/image", { method: "DELETE" }),
      async () => {
        setAvatarV(null);
        clearSelection();
        broadcastAvatar(null);
      },
    );
  }

  const shownSrc = previewUrl ?? avatarSrc(userId, avatarV ?? undefined);

  return (
    <form onSubmit={handleSubmit} aria-busy={busy} className="flex flex-col items-center gap-8">
      <Image
        data-avatar-preview
        unoptimized
        src={shownSrc}
        alt="Prévia da imagem de perfil"
        width={160}
        height={160}
        className={`${stacked ? "size-30" : "size-40"} shrink-0 rounded-full object-cover outline-2 outline-offset-4 outline-[var(--fairy)]`}
      />
      <div className="flex w-full max-w-xs min-w-0 flex-col items-center gap-5">
        <div className="flex w-full flex-col items-center gap-2 text-center">
          <input
            ref={inputRef}
            id="profile-image-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            disabled={busy}
            className="peer sr-only"
          />
          <label
            htmlFor="profile-image-file"
            className={`${buttonClass({ variant: "outline", className: "w-full cursor-pointer" })} reticle-peer peer-disabled:pointer-events-none peer-disabled:opacity-50`}
          >
            Escolher imagem
          </label>
          <p className="max-w-full truncate text-caption text-[var(--ink-muted)]">
            {file ? file.name : "PNG, JPEG ou WebP, até 2 MB"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button type="submit" disabled={busy || !file} aria-busy={busy} className="w-full">
            {busy ? "Enviando..." : "Enviar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleRemove}
            disabled={busy || avatarV === null}
            className="w-full"
          >
            Remover imagem
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-body text-[var(--heart)]">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
