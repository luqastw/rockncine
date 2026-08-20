import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const room = await prisma.room.create({
    data: { ownerId: session.user.id },
  });

  return NextResponse.redirect(new URL(`/rooms/${room.code}`, req.url));
}
