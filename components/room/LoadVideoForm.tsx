"use client";

import { useState } from "react";
import { useLoadVideo } from "@/hooks/useLoadVideo";

export function LoadVideoForm({ roomCode, userId }: { roomCode: string; userId: string }) {
  const loadVideo = useLoadVideo(roomCode, userId);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          try {
            await loadVideo(url);
            setUrl("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "erro ao carregar link.");
          } finally {
            setLoading(false);
          }
        }}
        className="flex gap-2"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="cole um link (YouTube, Vimeo, Drive, outro)"
          className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 shrink-0 rounded-md bg-[var(--ember)] px-4 text-sm font-medium text-[var(--bg-void)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
        >
          {loading ? "carregando..." : "carregar"}
        </button>
      </form>
      {error && <p className="text-sm text-[var(--ember)]">{error}</p>}
    </div>
  );
}
