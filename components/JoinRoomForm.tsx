"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/rooms/${trimmed.toUpperCase()}`);
      }}
      className="flex gap-2"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Código da sala"
        aria-label="Código da sala"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        surface
        className="min-w-0 flex-1 font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal [&:not(:placeholder-shown)]:uppercase"
      />
      <Button type="submit" variant="primary" className="shrink-0">
        Entrar
      </Button>
    </form>
  );
}
