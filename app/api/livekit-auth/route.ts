import { AccessToken } from "livekit-server-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIVEKIT_TOKEN_TTL, livekitCredentials } from "@/lib/livekit";

// Credencial de transmissão por sala. Espelha `app/api/liveblocks-auth/route.ts`
// — sessão, sala inexistente, membership — porque é a mesma autorização: quem
// não é membro da sala não tem por que receber mídia dela.
//
// A diferença em relação à rota do Liveblocks é o corpo da resposta: ali volta
// um token JWT autorizando a conexão, aqui um JWT do LiveKit, minificado pelo
// `livekit-server-sdk` e assinado com a chave do projeto. Nada de vídeo passa
// pelo nosso servidor (ver não-objetivo de recodificação em
// docs/specs/12-transmissao-screen-share/spec.md, seção 3).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("não autenticado.", { status: 401 });
  }

  // Sem credencial do Livekit não há token possível. 503 e não 500: a falha é
  // de configuração do deploy, e o cliente trata como "transmissão
  // indisponível" em vez de erro.
  const credentials = livekitCredentials();
  if (!credentials) {
    return new Response("transmissão não configurada.", { status: 503 });
  }

  // `req.json()` pode lançar em corpo malformado; a rota do Liveblocks tem o
  // mesmo furo e uma leitura de corpo quebrada viraria 500 sem status de
  // verdade.
  const body: unknown = await req.json().catch(() => null);
  const roomCode = (body as { room?: unknown } | null)?.room;
  if (typeof roomCode !== "string" || roomCode.length === 0) {
    return new Response("room inválida.", { status: 400 });
  }

  const room = await prisma.room.findUnique({ where: { code: roomCode } });
  if (!room) {
    return new Response("sala não encontrada.", { status: 404 });
  }

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: session.user.id } },
  });
  if (!membership) {
    return new Response("não é membro desta sala.", { status: 403 });
  }

  // A room do LiveKit é nomeada com o código da sala (FR-020): uma sala do
  // RockNCine = uma room do Livekit, o que torna o par código/room trivial de
  // auditar e impede colisão entre salas de projetos diferentes. Publicar e
  // assinar é o mínimo para os dois papéis — o transmissor publica a track de
  // tela, o espectador assina.
  //
  // `canPublishData: false` e `roomRecord` ausente fecham as duas saídas que a
  // spec descarta: data channel (o estado de transmissão mora no storage, ver
  // docs/specs/12-transmissao-screen-share/spec.md, seção 7) e gravação
  // (não-objetivo explícito).
  const token = new AccessToken(credentials.apiKey, credentials.apiSecret, {
    identity: session.user.id,
    name: session.user.name ?? session.user.email ?? "sem nome",
    ttl: LIVEKIT_TOKEN_TTL,
  });
  token.addGrant({
    room: roomCode,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  return new Response(await token.toJwt(), {
    status: 200,
    headers: { "content-type": "application/jwt" },
  });
}
