import { memo } from "react";
import { Avatar } from "@/components/room/Avatar";
import { dayLabel, timeLabel } from "@/lib/chat-log";
import type { ChatEvent, SystemEvent } from "@/liveblocks.config";

// Todo item é memoizado (FR-010): com 30 itens no log, digitar uma letra
// reconciliava os 30 `<li>` por baixo sem que nenhum deles tivesse mudado.
export const MessageItem = memo(function MessageItem({
  item,
  grouped,
  isSelf,
}: {
  item: ChatEvent;
  grouped: boolean;
  isSelf: boolean;
}) {
  const time = timeLabel(item.ts);
  return (
    // `data-self` é o gancho de teste da AC-013.
    //
    // A mensagem própria é destacada por ALINHAMENTO e por uma caixa mais
    // escura (`--bg-void` sobre o `--bg-surface` do log) com fio de borda — e
    // não por inversão. A versão desta spec que invertia para branco mediu
    // errado na tela real: com uma pessoa só na sala quase toda linha virava
    // bloco branco, e a sala escura passava a parecer clara. A inversão
    // (`--invert-bg`) fica reservada para o que é estado ativo e CTA — contador
    // de não lidas, "novas mensagens", "enviar" — que é como o projeto já a usa
    // (app/globals.css).
    <li
      data-self={isSelf ? "true" : undefined}
      className={`flex ${isSelf ? "justify-end" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}
    >
      <div
        className={
          isSelf
            ? "max-w-[85%] rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2"
            : "max-w-full"
        }
      >
        {grouped ? (
          // No item agrupado o cabeçalho não está visível (FR-012), então autor e
          // horário precisam continuar disponíveis para o leitor de tela
          // (FR-022, AC-017).
          <span className="sr-only">{`${item.authorName}, ${time}: `}</span>
        ) : (
          <span className="flex items-center gap-2">
            <Avatar userId={item.authorId} avatarV={item.avatarV} size="sm" />
            <span className="min-w-0 truncate text-body-sm font-medium text-[var(--ink)]">
              {item.authorName}
            </span>
            {isSelf && <span className="text-caption text-[var(--ink-muted)]">(você)</span>}
            <time
              dateTime={new Date(item.ts).toISOString()}
              className="ml-auto shrink-0 font-mono text-micro text-[var(--ink-muted)]"
            >
              {time}
            </time>
          </span>
        )}
        {/* A caixa elevada é a única diferença estrutural entre falar e falar
            (FR-017); o contraste continua em 12:1. */}
        <p className="break-words text-body leading-relaxed text-[var(--ink)]">
          {item.text}
        </p>
      </div>
    </li>
  );
});

export const SystemItem = memo(function SystemItem({ item }: { item: SystemEvent }) {
  return (
    <li className="my-1.5 flex items-center gap-2 text-caption italic text-[var(--ink-muted)]">
      <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
      <span className="min-w-0 text-center">
        <span className="sr-only">aviso da sala: </span>
        {item.text}
      </span>
      <span className="h-px flex-1 bg-[var(--line)]" aria-hidden />
    </li>
  );
});

/**
 * Divisória do log.
 *
 * `aria-hidden` de propósito: o log é região `aria-live` com
 * `aria-relevant="additions"`, então cada nó novo é anunciado. A divisória é
 * informação visual de posição — o que o leitor de tela precisa já está em cada
 * item (autor no cabeçalho, horário em `<time>`), e a mensagem que acabou de
 * chegar é anunciada de qualquer forma. Anunciar "hoje" ou "novas mensagens" em
 * cima disso é redundância que vira barulho. O que precisa ser lido — autor e
 * horário do item agrupado — está no texto acessível do próprio item (AC-017).
 */
export function DividerLine({ label, strong }: { label: string; strong?: boolean }) {
  const line = strong ? "bg-[var(--ink-muted)]" : "bg-[var(--line)]";
  return (
    <li
      aria-hidden
      className={`my-1.5 flex items-center gap-2 font-mono text-micro uppercase tracking-wide text-[var(--ink-muted)] ${strong ? "font-medium" : ""}`}
    >
      <span className={`h-px flex-1 ${line}`} aria-hidden />
      <span className="shrink-0">{label}</span>
      <span className={`h-px flex-1 ${line}`} aria-hidden />
    </li>
  );
}

// O rótulo do dia ("hoje", "ontem", "sábado, 03/10") depende do AGORA, não do
// item: uma mensagem de ontem continua "ontem" amanhã. Por isso ele é resolvido
// no render do divisor e não dentro do `buildLog` memoizado — que recebe só o
// `ts` e fica puro em relação ao relógio (ver `buildLog`).
// `todayKey` é dependência explícita: memoizar só pelo `ts` congelaria o rótulo.
// "Ontem" é uma relação com o dia de hoje, e o dia de hoje muda (FR-014).
export const DayDivider = memo(function DayDivider({ ts, todayKey }: { ts: number; todayKey: string }) {
  return <DividerLine label={dayLabel(ts, todayKey)} />;
});

export const UnreadDivider = memo(function UnreadDivider() {
  return <DividerLine label="novas mensagens" strong />;
});
