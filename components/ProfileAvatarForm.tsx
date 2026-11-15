"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { avatarSrc } from "@/lib/avatar";
import { Button } from "@/components/ui/Button";

const MAX_BYTES = 2_097_152;
const TOO_LARGE_MESSAGE = "imagem muito grande (máx 2 MB).";
const NETWORK_MESSAGE = "não foi possível enviar. tente de novo.";

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
}: {
  userId: string;
  initialAvatarV: number | null;
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
    <form onSubmit={handleSubmit} aria-busy={busy} className="flex flex-col gap-4">
      <Image
        unoptimized
        src={shownSrc}
        alt="prévia da imagem de perfil"
        width={96}
        height={96}
        className="h-24 w-24 rounded-full object-cover"
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="profile-image-file" className="text-body-sm text-[var(--ink)]">
          escolher imagem (png, jpeg ou webp, até 2 MB)
        </label>
        <input
          ref={inputRef}
          id="profile-image-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          disabled={busy}
          className="text-body-sm text-[var(--ink)]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !file} aria-busy={busy}>
          {busy ? "enviando..." : "enviar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleRemove}
          disabled={busy || avatarV === null}
        >
          remover imagem
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-[var(--ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}
