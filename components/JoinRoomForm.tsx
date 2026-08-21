"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/rooms/${trimmed}`);
      }}
      className="flex gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="código da sala"
        className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
      />
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-md border border-[var(--line)] px-4 text-sm text-[var(--ink)] hover:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]"
      >
        entrar
      </button>
    </form>
  );
}
