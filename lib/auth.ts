import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // O callback de credenciais do NextAuth não tem rate limit próprio:
        // sem isto o endpoint aceita tentativas de senha sem limite. A chave é
        // o IP, e **não** o email — limitar por email permitiria a qualquer um
        // trancar a conta de outra pessoa com tentativas falhas.
        const ip = clientIpFromHeaders(req?.headers ?? {});
        const attempt = checkRateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 60_000 });
        if (!attempt.allowed) return null;

        // registro normaliza email pra lowercase+trim (app/api/register/route.ts)
        // — sem normalizar aqui também, um usuário que digitar/colar o email com
        // capitalização diferente da que usou no cadastro toma "credenciais
        // inválidas" mesmo com a senha certa.
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
