import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// `cache()` do React deduplica a chamada dentro do mesmo render pass: layout e
// page do mesmo segmento pedem a sessão e o NextAuth resolve uma única vez.
export const getSession = cache(() => getServerSession(authOptions));

export type SessionUser = { userId: string; userName: string };

// Guard canônico de sessão em server component. Layout e page renderizam em
// paralelo no App Router, então a page NÃO pode assumir que o layout já
// redirecionou — chamar isto nos dois é o que evita `session!.user!.id`.
export const requireSession = cache(async (): Promise<SessionUser> => {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  return {
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "sem nome",
  };
});
