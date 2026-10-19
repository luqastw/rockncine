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
        if (trimmed) router.push(`/rooms/${trimmed}`);
      }}
      className="flex gap-2"
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="código da sala"
        aria-label="código da sala"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className="min-w-0 flex-1 font-mono tracking-wider placeholder:tracking-normal"
      />
      <Button type="submit" variant="outline" className="shrink-0">
        entrar
      </Button>
    </form>
  );
}
