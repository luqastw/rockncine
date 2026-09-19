import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  // registro é o alvo mais barato para script automatizado: insere linha no
  // banco e roda bcrypt. Limita por IP antes de qualquer trabalho caro.
  const limited = rateLimitRequest(req, { scope: "register", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email inválido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "senha precisa de ao menos 8 caracteres." },
      { status: 400 },
    );
  }

  // caminho rápido só para não pagar bcrypt em email já cadastrado. Quem
  // garante a unicidade é a constraint, não esta consulta.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "email já cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Criação atômica. O `findUnique` + `create` de antes perdia a corrida entre
  // duas requisições simultâneas com o mesmo email, e o P2002 explodia como 500.
  //
  // O 409 revela que o email existe (enumeração). Sem infra de envio de email
  // não dá para trocar por "201 sempre, confirme seu email" sem quebrar o
  // cadastro de quem já tem conta — a mitigação prática aqui é o rate limit.
  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "email já cadastrado." }, { status: 409 });
    }
    throw err;
  }
}
