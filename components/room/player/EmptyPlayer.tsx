"use client";

import { useState } from "react";
import { useLoadVideo } from "@/hooks/useLoadVideo";
import { PlayIcon } from "@/components/room/player/icons";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Input";

export function EmptyPlayer({ roomCode, userId }: { roomCode: string; userId: string }) {
  const loadVideo = useLoadVideo(roomCode, userId);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-6 text-center">
      <span
        aria-hidden="true"
        className="hidden size-14 shrink-0 items-center justify-center sm:flex rounded-full border border-[var(--gold)] text-[var(--gold-hi)]"
      >
        <PlayIcon className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-card font-semibold tracking-tight text-[var(--ink)]">
          Nenhum vídeo carregado
        </p>
        <p className="text-body text-[var(--ink-muted)]">
          Cole um link do YouTube, Vimeo ou mídia direta
        </p>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!url.trim()) return;
          setError(null);
          setLoading(true);
          try {
            await loadVideo(url);
            setUrl("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao carregar link.");
          } finally {
            setLoading(false);
          }
        }}
        className="flex w-full max-w-xl gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link aqui"
          aria-label="Colar link do vídeo"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputClass({ surface: true, className: "min-w-0 flex-1" })}
        />
        <Button type="submit" disabled={loading || !url.trim()} className="shrink-0">
          {loading ? "Carregando..." : "Carregar link"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-body-sm text-[var(--heart)]">
          {error}
        </p>
      )}
    </div>
  );
}
