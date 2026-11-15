import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { isAvatarUserId, parseAvatarVersion } from "@/lib/avatar";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NO_STORE = { "Cache-Control": "no-store" };
const IMMUTABLE = "private, max-age=31536000, immutable";

export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "não autenticado." }, { status: 401 });
  }

  const { userId } = await ctx.params;
  if (!isAvatarUserId(userId)) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }

  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { data: true, updatedAt: true },
  });
  if (!image) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }

  const current = image.updatedAt.getTime();
  const requested = parseAvatarVersion(Number(new URL(req.url).searchParams.get("v")));

  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": requested === current ? IMMUTABLE : "no-store",
    },
  });
}
