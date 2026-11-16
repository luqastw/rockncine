"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
          const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            setError(data?.error ?? "Não foi possível cadastrar.");
            return;
          }

          const signInRes = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (signInRes?.error) {
            router.push("/login");
            return;
          }
          router.push("/rooms");
          router.refresh();
        } catch {
          // Mesmo caso do LoginForm: sem o catch, falha de rede em qualquer um
          // dos dois `await` (registro ou login automático) deixava o botão
          // travado em "criando..." sem mensagem nenhuma.
          setError("Não foi possível cadastrar. verifique sua conexão e tente de novo.");
        } finally {
          setLoading(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5 text-body-sm text-[var(--ink-muted)]">
        Nome (opcional)
        <Input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-body-sm text-[var(--ink-muted)]">
        Email
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-body-sm text-[var(--ink-muted)]">
        Senha (mín. 8 caracteres)
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--heart)] bg-[var(--fill-1)] px-3 py-2 text-body-sm font-semibold text-[var(--heart)]"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
