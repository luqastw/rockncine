// Estado do feed de chat fora do React.
//
// O defeito que isto resolve: `useChat` era chamado no corpo de `RoomExperience`,
// e o `setMessages` de cada item do broadcast acordava a árvore inteira da sala
// — `PresenceList`, `SyncRing`, `PlayerShell`, `InviteCode`, `RoomActions`.
// Medido: 1 render fora do log por mensagem recebida, com 30 itens na tela
// (docs/specs/13-chat-sala/research.md, seção 2).
//
// É o mesmo movimento que o playhead deu em `hooks/usePlaybackClock.ts`: estado
// que muda por evento de sala mora numa store com assinatura, e só quem assina
// re-renderiza (FR-001). O que muda aqui é que quem assina é o `<Chat>`, não a
// sala — por isso `useChat` deixou de ser chamado em `RoomExperience`.
//
// Lógica pura, sem React: `hooks/useChatFeed.ts` assina, `hooks/useChat.ts`
// emite, e `components/room/Chat.tsx` renderiza.

import type { ChatFeedItem } from "@/lib/chat-event";

// Teto de 30 itens, com mensagens de sistema no mesmo orçamento das de chat
// (docs/specs/10-exclusao-sala-limite-chat/spec.md, FR-015 a FR-018). A
// decision de histórico efêmero é da spec 01, seção 2: isto aqui não é
// arquivo, é sessão.
export const MAX_MESSAGES = 30;

// ── store ─────────────────────────────────────────────────────────────────────

type Listener = () => void;

let items: ChatFeedItem[] = [];
// Índice de ids vistos, para dedupe. Não cresce sem limite: quando o teto
// descarta algo, ele é reconstruído a partir do que sobrou no feed (FR-003) —
// assim um id descartado pode voltar a ser aceito, e o conjunto nunca passa do
// tamanho do feed.
let seenIds = new Set<string>();
const listeners = new Set<Listener>();

// De qual sala é o feed guardado. A store é um módulo e sobrevive à sala (é o
// que a mantém viva sem recriar a cada StrictMode), então o feed da sala anterior
// continuaria aqui ao entrar na próxima. Zerar no `useEffect` de montagem
// resolveria no efeito seguinte — tarde demais: existe um quadro renderizado
// antes dele com as mensagens da sala que o usuário acabou de sair. Por isso a
// virada é resolvida na LEITURA, com a chave da sala em mãos (FR-007).
let activeRoom: string | null = null;

/**
 * Vira a store para outra sala, se for outra.
 *
 * A primeira leitura DEPOIS de um reset adota a sala sem descartar o que já
 * estiver lá: `appendChatItem` não sabe de qual sala é o item (ela é chamada do
 * hook de envio e do de saída, que nenhum dos dois carrega a chave), e exigir
 * ordem entre "anexar" e "ler" seria um estado só por convenção — o primeiro teste
 * que escrevi provou que essa convenção quebra.
 *
 * Já a troca de verdade (sala A → sala B) descarta: é o que evita o quadro com o
 * histórico da sala anterior.
 */
function ensureRoom(room: string) {
  if (room === activeRoom) return;
  if (activeRoom !== null) {
    items = [];
    seenIds = new Set();
  }
  activeRoom = room;
}

/**
 * Snapshot para `useSyncExternalStore`, já virado para a sala pedida.
 *
 * Precisa devolver a MESMA referência enquanto o feed não muda: o React compara
 * com `Object.is` e um array novo a cada chamada re-renderiza sempre. Por isso o
 * array só é substituído em `appendChatItem`.
 */
export function getChatFeed(room: string): ChatFeedItem[] {
  ensureRoom(room);
  return items;
}

export function subscribeChatFeed(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Insere mantendo a ordem do relógio.
 *
 * A ordenação deixou de ser só estética quando o envio passou a ser enfileirado
 * em queda de conexão (FR-005): o que estava pendente é despejado quando o
 * socket volta e chega depois de mensagens mais novas de outros participantes.
 * Inserir na posição do `ts` é o que impede a frase de aparecer no fim do log
 * como se tivesse sido escrita agora (FR-004).
 *
 * Empates de `ts` mantêm a ordem de chegada: a comparação é estrita, então um
 * item novo entra DEPOIS dos que já estão com o mesmo `ts`.
 */
function insertOrdered(item: ChatFeedItem): ChatFeedItem[] {
  const at = items.findIndex((existing) => existing.ts > item.ts);
  if (at === -1) return [...items, item];
  return [...items.slice(0, at), item, ...items.slice(at)];
}

/** Anexa um item ao feed, deduplicando por id e respeitando o teto de 30. */
export function appendChatItem(item: ChatFeedItem): void {
  if (seenIds.has(item.id)) return;
  seenIds.add(item.id);

  const next = insertOrdered(item);
  const limited = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
  if (limited.length !== next.length) {
    // Algo saiu pelo teto: o índice de ids precisa ser reconstruído a partir do
    // que sobrou, senão ele volta a crescer sem limite ao longo da sessão.
    seenIds = new Set(limited.map((message) => message.id));
  }
  items = limited;

  for (const listener of listeners) listener();
}

/**
 * Zera o feed e esquece a sala.
 *
 * Quem usa no produto é o teste: a virada de sala real acontece em
 * `getChatFeed(room)`, que conhece a chave. O reset existe para o estado inicial
 * de um teste e para um futuro caminho de saída explícita — por isso ele também
 * limpa `activeRoom`, para o próximo `getChatFeed` reassumir.
 */
export function resetChatFeed(): void {
  activeRoom = null;
  if (items.length === 0 && seenIds.size === 0) return;
  items = [];
  seenIds = new Set();
  for (const listener of listeners) listener();
}