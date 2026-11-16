import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Input";
import { EmojiButton } from "@/components/room/chat/EmojiButton";
import { useAutoGrowTextarea } from "@/hooks/useAutoGrowTextarea";
import { MAX_TEXT_LENGTH } from "@/lib/chat-event";
import { insertAtCaret, isEmojiOnly } from "@/lib/emoji";

// a partir deste tanto do limite o contador aparece, para quem escreve uma frase
// longa saber onde está o fim (FR-025).
const COUNTER_FROM = Math.floor(MAX_TEXT_LENGTH * 0.8);

const STATUS_NOTICE: Record<string, string> = {
  initial: "Conectando… A mensagem fica na fila até a sala abrir.",
  connecting: "Conectando… A mensagem fica na fila até a sala abrir.",
  reconnecting: "Reconectando… A mensagem fica na fila e sai assim que voltar.",
  disconnected: "Sem conexão… A mensagem fica na fila e sai assim que voltar.",
};

export function ChatComposer({
  status,
  onSend,
  onTyping,
}: {
  status: string;
  onSend: (text: string) => void;
  onTyping: () => void;
}) {
  const [draft, setDraft] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useAutoGrowTextarea(fieldRef, draft);

  const submit = useCallback(
    (text?: string) => {
      const value = (text ?? draft).trim();
      if (!value) return;
      onSend(value);
      setDraft("");
    },
    [draft, onSend],
  );

  // Emoji entra onde o cursor está (FR-027). Antes ele era concatenado no fim
  // do texto, o que jogava o emoji para depois da palavra que o usuário estava
  // escrevendo. E um campo que ficava só com o emoji manda na hora: é o gesto
  // que as pessoas esperam de um atalho de emoji em chat.
  const insertEmoji = useCallback(
    (emoji: string) => {
      const field = fieldRef.current;
      const current = draft;
      if (!field || field.selectionStart === null) {
        setDraft(current + emoji);
        return;
      }
      const start = field.selectionStart;
      const end = field.selectionEnd ?? start;
      const { next, caret } = insertAtCaret(current, emoji, start, end);
      setDraft(next);

      if (current.trim() === "" && isEmojiOnly(next)) {
        submit(next);
        return;
      }

      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(caret, caret);
      });
    },
    [draft, submit],
  );

  const draftLength = draft.length;
  const showCounter = draftLength >= COUNTER_FROM;
  const overLimit = draftLength > MAX_TEXT_LENGTH;
  const notice = status === "connected" ? null : (STATUS_NOTICE[status] ?? null);

  return (
    // O composer fica preso no rodapé do chat quando o conteúdo rola: o
    // campo de mensagem é o único caminho de entrada na sala, então ele não
    // pode depender de o usuário descobrir que há conteúdo abaixo (ainda
    // mais com a barra de rolagem escondida, por decisão de design). Sem
    // overflow, `sticky` não desloca nada — só age no caso apertado. O fundo
    // opaco é para o conteúdo não passar por trás do campo durante a
    // rolagem.
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-1 max-lg:sticky max-lg:bottom-0 max-lg:bg-[var(--bg-void)]"
    >
      {/* Envio em fila, e não descarte silencioso (FR-005/FR-006): o campo
          continua aceitando texto durante a reconexão porque a mensagem vai
          para a fila local de `useChat`, que despeja no `connected` — o que não
          existia antes desta spec. */}
      {notice && (
        <p role="status" className="text-caption text-[var(--ink-muted)]">
          {notice}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={fieldRef}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            // Enter envia, Shift+Enter quebra a linha (FR-024). `isComposing`
            // é o que impede o Enter de fechar o candidato de um IME e enviar
            // a mensagem pela metade.
            if (event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
          onFocus={() => {
            // Teclado virtual no mobile (FR-028): o campo é o único caminho
            // de entrada da sala e ele nasce embaixo da dobra.
            const form = formRef.current;
            if (form && typeof form.scrollIntoView === "function") {
              form.scrollIntoView({ block: "nearest" });
            }
          }}
          rows={1}
          placeholder="Mensagem"
          aria-label="Mensagem para o chat da sala"
          autoComplete="off"
          className={inputClass({
            className:
              "max-h-24 min-w-0 flex-1 resize-none overflow-y-auto leading-5",
          })}
        />
        <EmojiButton onPick={insertEmoji} />
        <Button type="submit" className="shrink-0">
          Enviar
        </Button>
      </div>
      {/* Nenhum corte mudo (FR-025): o teto de 500 caracteres é do validador de
          entrada, então quem escreve precisa enxergar onde ele está antes de
          a frase ser cortada no envio. */}
      {showCounter && (
        // Sem `role="status"`: o contador muda a cada tecla perto do limite, e
        // anunciar a própria contagem a cada tecla é barulho. O texto de corte é
        // o que importa, e esse é raro.
        <p
          className={`self-end font-mono text-caption ${
            overLimit ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
          }`}
        >
          {draftLength}/{MAX_TEXT_LENGTH}
          {overLimit ? " — vai ser cortada" : ""}
        </p>
      )}
    </form>
  );
}
