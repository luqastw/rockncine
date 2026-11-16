"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const router = useRouter();
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
          const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (res?.error) {
            setError("Não bateu. Confere o email e a senha.");
            return;
          }
          router.push("/rooms");
          router.refresh();
        } catch {
          // Sem isto, uma falha de rede (o fetch do next-auth rejeitando)
          // pulava o `setLoading(false)` e deixava o botão desabilitado em
          // "entrando..." para sempre, sem nenhuma mensagem — a promise
          // rejeitada também virava unhandled rejection.
          setError("Não foi possível entrar. Verifique sua conexão e tente de novo.");
        } finally {
          setLoading(false);
        }
      }}
      className="flex flex-col gap-4"
    >
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
        Senha
        <Input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--heart)] bg-[var(--fill-1)] px-3 py-2 text-body-sm font-semibold text-[var(--heart)]"
        >
          <span aria-hidden="true" className="mr-2 font-mono text-[var(--heart)]">
            !
          </span>
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
