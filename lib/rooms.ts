import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Busca tolerante a caixa SEM ILIKE: `mode: "insensitive"` vira ILIKE no
// Postgres e trata `%`/`_` do segmento de URL cru como curinga — bypass de
// autorização real (achado 1, docs/specs/05-code-review-seguranca/spec.md).
// Duas comparações de igualdade exata cobrem o mesmo caso de uso: código curto
// ditado em qualquer caixa (lib/room-code.ts) e cuid antigo digitado como está.
//
// `cache()` deduplica: layout e page do mesmo segmento fazem exatamente esta
// busca, que antes eram duas idas ao Postgres por navegação.
export const getRoomByCode = cache(async (code: string) => {
  return prisma.room.findFirst({
    where: { OR: [{ code }, { code: code.toUpperCase() }] },
    select: {
      id: true,
      code: true,
      name: true,
      videoSource: true,
      embedUrl: true,
      videoSourceUrl: true,
    },
  });
});
