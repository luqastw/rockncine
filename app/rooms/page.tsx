import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JoinRoomForm } from "@/components/JoinRoomForm";
import { CreateRoomForm } from "@/components/CreateRoomForm";
import { DeleteRoomButton } from "@/components/DeleteRoomButton";
import { SignOutButton } from "@/components/SignOutButton";
import { PageShell } from "@/components/chrome/PageShell";
import { Reveal } from "@/components/chrome/Reveal";
import { SOURCE_LABEL } from "@/lib/video-source";

export const metadata: Metadata = { title: "suas salas · rockncine" };

// Quantas salas a lista carrega. A consulta ordena por ATIVIDADE e corta no
// limite — o corte é o que exige a seção de "carregar mais" abaixo, e não um
// `take` silencioso: com 20 fixas e nenhuma saída, a 21ª sala simplesmente
// sumia, sem aviso e sem forma de chegar nela.
const PAGE_SIZE = 20;

// Data relativa para os casos que importam ("hoje", "ontem", "há 3 dias") e
// data absoluta no resto. `toLocaleDateString` sem o ano em `DD/MM` fazia uma
// sala de janeiro do ano passado ser indistinguível de uma de ontem.
function formatWhen(date: Date) {
  const now = new Date();
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);

  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days > 1 && days < 7) return `há ${days} dias`;

  const mesmoAno = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(mesmoAno ? {} : { year: "2-digit" }),
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Página pedida além da primeira só faz sentido para quem está logado.
  const paginaPedida = Number.parseInt((await searchParams)?.pagina ?? "1", 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 1;

  // Salas em que o usuário é membro — `RoomMember` já era populado no acesso à
  // sala, mas nunca era lido: fechou a aba sem anotar o código e a sala estava
  // perdida, apesar de a spec dizer que ela "permanece indefinidamente"
  // (achado 7 da auditoria).
  //
  // A ORDEM é por `room.updatedAt`, não por `membership.joinedAt`. Ordenar por
  // "quando você entrou" punia exatamente as salas que importam: alguém que
  // entrou numa sala há meses e que está rolando agora aparecia no fim da
  // lista. `updatedAt` muda quando o vídeo da sala é trocado, que é o proxy
  // mais próximo de "atividade" disponível sem um modelo de eventos.
  const memberships = userId
    ? await prisma.roomMember.findMany({
        where: { userId },
        orderBy: { room: { updatedAt: "desc" } },
        // PAGE_SIZE + 1, não PAGE_SIZE: o item extra é o sinal de "existe
        // próxima página" sem precisar de uma segunda consulta de contagem.
        // `skip` abaixo de 0 faria o Prisma lançar, e a guarda de `pagina` vem
        // antes disto por isso.
        take: PAGE_SIZE + 1,
        skip: (pagina - 1) * PAGE_SIZE,
        select: {
          joinedAt: true,
          room: {
            select: {
              code: true,
              name: true,
              ownerId: true,
              updatedAt: true,
              videoSource: true,
            },
          },
        },
      })
    : [];

  // `PAGE_SIZE + 1` para saber se existe a próxima página sem uma segunda
  // consulta de contagem — o item extra é descartado da renderização.
  const temProxima = memberships.length > PAGE_SIZE;
  const visiveis = temProxima ? memberships.slice(0, PAGE_SIZE) : memberships;

  return (
    // O invólucro único (FR-018, docs/specs/14-identidade-fanzine-crt/spec.md) agora é o
    // `PageShell`: ele é dono da largura da coluna (`w-full` + `max-w-*` para o `mx-auto`
    // não desligar o stretch — ver comentário original desta página), do padding e do grão.
    // A marca saiu deste arquivo e vive no `ChromeBar`.
    <PageShell width="md" chrome className="justify-center gap-10">
      {/* A marca está no ChromeBar; este h1 preserva a semântica de título da página
          sem duplicar o texto visível. Mantém o papel Display da spec 06 (AC-003:
          mesmo font-weight e letter-spacing nos h1) para o guard de consistência
          continuar valendo. */}
      <h1 className="sr-only font-semibold tracking-tight">suas salas</h1>

      <Reveal as="header" className="flex items-start justify-between gap-4">
        <p className="text-sm text-[var(--ink-muted)]">
          {session?.user?.name ?? session?.user?.email}
        </p>
        <SignOutButton />
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          criar sala
        </h2>
        <CreateRoomForm />
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          entrar por código
        </h2>
        <JoinRoomForm />
      </Reveal>

      <Reveal as="section" className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          suas salas
        </h2>
        {visiveis.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            {pagina > 1
              ? "não há mais salas nesta página."
              : "nenhuma sala ainda — crie uma acima ou entre por código."}
          </p>
        ) : (
          <ul className="room-list flex flex-col gap-2">
            {visiveis.map(({ room }) => (
              // `items-stretch` (e não `items-center`): o card tem duas linhas e
              // fica com ~58px, o botão de excluir tem 44px — centrado, os dois
              // retângulos ficavam com alturas diferentes e as bordas não
              // alinhavam (parecia quebrado). Esticado, o botão acompanha a
              // altura do card.
              <li key={room.code} className="flex items-stretch gap-2">
                <Link
                  href={`/rooms/${room.code}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-md border border-[var(--ink-muted)] bg-[var(--bg-surface)] px-3 py-2 hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-[var(--ink)]">
                      {room.name || "sala sem nome"}
                    </span>
                    {/* O que está tocando. A fonte já vinha no select da
                        consulta anterior e não era usada — a pergunta que a
                        lista responde é "qual sala eu vou abrir", e o nome não
                        basta quando todas se chamam "sala". `truncate`
                        mantém o cartão com a mesma altura dos outros. */}
                    <span className="truncate text-xs text-[var(--ink-muted)]">
                      {room.code}
                      {room.videoSource ? ` · ${SOURCE_LABEL[room.videoSource]}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--ink-muted)]">
                    {room.ownerId === userId ? "sua · " : ""}
                    {formatWhen(room.updatedAt)}
                  </span>
                </Link>
                {/* Botão irmão do Link, nunca filho — interativo aninhado em
                    interativo é HTML inválido. Só aparece na sala de quem é
                    dono (FR-001/FR-002), e o servidor reconfere. */}
                {room.ownerId === userId && (
                  <DeleteRoomButton roomCode={room.code} roomName={room.name} />
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Navegação de páginas. Antes não existia: com `take: 20` fixo e sem
            esta seção, a 21ª sala sumia da lista sem aviso e sem caminho de
            volta. */}
        {(pagina > 1 || temProxima) && (
          <nav aria-label="páginas de salas" className="flex items-center justify-between gap-2">
            {pagina > 1 ? (
              <Link
                href={`/rooms?pagina=${pagina - 1}`}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-3 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
              >
                ← anteriores
              </Link>
            ) : (
              <span />
            )}
            <span className="font-mono text-xs text-[var(--ink-muted)]">página {pagina}</span>
            {temProxima ? (
              <Link
                href={`/rooms?pagina=${pagina + 1}`}
                className="inline-flex min-h-11 items-center rounded-md border border-[var(--ink-muted)] px-3 text-sm text-[var(--ink)] hover:border-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--focus-offset)]"
              >
                mais →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Reveal>
    </PageShell>
  );
}
