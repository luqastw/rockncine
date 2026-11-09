import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatFeedItem } from "@/lib/chat-event";

// distância do fim (px) dentro da qual a lista ainda conta como "colada no
// rodapé" — acima disso o usuário está lendo o histórico e não deve ser
// arrastado pra baixo a cada mensagem nova (achado 14 da auditoria).
const PIN_THRESHOLD_PX = 48;

/**
 * Rola o log até o fim.
 *
 * `behavior: "auto"` (instantâneo) quando quem manda é quem está vendo a própria
 * mensagem: uma animação de rolagem aqui torna o texto que acabou de ser escrito
 * chegar com atraso (FR-019). Com o movimento desligado — `prefers-reduced-motion`
 * ou modo economy, que zera transição globalmente em `app/globals.css` — também
 * instantâneo.
 */
function scrollLogToEnd(list: HTMLElement, behavior: ScrollBehavior) {
  const top = list.scrollHeight;
  if (typeof list.scrollTo === "function") {
    list.scrollTo({ top, behavior });
    return;
  }
  list.scrollTop = top; // jsdom e navegadores sem `scrollTo` no elemento
}

function motionAllowed(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains("reduce-motion")) return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

export function useStickyScroll(messages: ChatFeedItem[]) {
  const [hasNew, setHasNew] = useState(false);
  const [unreadId, setUnreadId] = useState<string | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  // ref, não state: entra no efeito de mensagens sem virar dependência dele.
  const pinnedRef = useRef(true);
  // quem acabou de enviar não espera animação para ver a própria frase.
  const justSentRef = useRef(false);
  const prevIdsRef = useRef<string[]>([]);

  const markAsRead = useCallback(() => {
    pinnedRef.current = true;
    setHasNew(false);
    setUnreadId(null);
    setScrolledUp(false);
  }, []);

  // O botão promete "novas mensagens ↓": ele tem que ROLAR, não só limpar a
  // marca. Rola sem animação — quem clicou quer o fim na tela agora.
  const goToLatest = useCallback(() => {
    markAsRead();
    const list = listRef.current;
    if (list) scrollLogToEnd(list, "auto");
  }, [markAsRead]);

  const markSent = useCallback(() => {
    justSentRef.current = true;
    pinnedRef.current = true;
  }, []);

  const resetUnread = useCallback(() => {
    setHasNew(false);
    setUnreadId(null);
    setScrolledUp(false);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const previousIds = prevIdsRef.current;
    const nextIds = messages.map((message) => message.id);

    if (list && pinnedRef.current) {
      scrollLogToEnd(list, justSentRef.current ? "auto" : motionAllowed() ? "smooth" : "auto");
      justSentRef.current = false;
      markAsRead();
    } else if (!pinnedRef.current) {
      const arrived = nextIds.find((id) => !previousIds.includes(id));
      if (arrived) {
        setHasNew(true);
        // A divisória fica no PRIMEIRO item que chegou com o usuário longe do
        // rodapé. Se a mensagem atrasada (FR-004) entrar no meio do log, a
        // posição real é a do item, não a do fim.
        setUnreadId((current) => current ?? arrived);
      }
    }

    prevIdsRef.current = nextIds;
  }, [messages, markAsRead]);

  const onScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    const atBottom = distance < PIN_THRESHOLD_PX;
    pinnedRef.current = atBottom;
    setScrolledUp(list.scrollTop > 8);
    if (atBottom) markAsRead();
  }, [markAsRead]);

  return { listRef, hasNew, unreadId, scrolledUp, goToLatest, onScroll, markSent, resetUnread };
}
