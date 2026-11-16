"use client";

import { useCallback, useState } from "react";
import { useMyPresence, useOthers } from "@liveblocks/react";
import { ChevronDownIcon } from "@/components/room/player/icons";
import { Avatar } from "@/components/room/Avatar";
import { parseAvatarVersion } from "@/lib/avatar";

// Quem está na sala, deduplicado por pessoa.
type OtherPresence = {
  presence?: { userId: string; name: string; avatarV?: number | null } | null;
};

function uniqueOthers(others: readonly OtherPresence[], myUserId: string) {
  // `useOthers` lista por CONEXÃO: a mesma pessoa com duas abas abertas
  // aparecia duas vezes, sem nenhuma indicação de que era a mesma pessoa
  // (achado 26 da auditoria). Deduplica por userId e tira as outras conexões
  // do próprio usuário.
  const byUser = new Map<string, { name: string; avatarV: number | undefined }>();
  for (const other of others) {
    // `presence` é opcional no tipo e pode ser `null`: o check cobre os dois, e
    // o `name` só é lido depois do id — que é o que prova que o objeto existe.
    const id = other.presence?.userId;
    if (!id || id === myUserId) continue;
    byUser.set(id, {
      name: other.presence?.name ?? "",
      avatarV: parseAvatarVersion(other.presence?.avatarV),
    });
  }
  return byUser;
}

/**
 * Estado do recolher da lista.
 *
 * O estado vive aqui, e não dentro de `PresenceTrigger`, porque o gatilho e a
 * lista são irmãos na `aside` (FR-021, docs/specs/13-chat-sala/spec.md) — o
 * gatilho virou parte da fileira de ações da sala e a lista desceu para baixo
 * dela. Com o estado dentro do gatilho, os dois não conversariam.
 */
export function usePresenceDisclosure() {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  return { expanded, toggle };
}

/**
 * Botão "N na sala" + o chevron.
 *
 * Identidade pelo avatar da pessoa, com a imagem padrão quando ela não definiu
 * uma.
 */
export function PresenceTrigger({
  expanded,
  onToggle,
  myUserId,
  myAvatarV,
}: {
  expanded: boolean;
  onToggle: () => void;
  myUserId: string;
  myName: string;
  myAvatarV?: number | null;
}) {
  const others = useOthers();
  const [myPresence] = useMyPresence();
  const total = uniqueOthers(others, myPresence.userId ?? myUserId).size + 1;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls="presence-list"
      className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--fill-1)] px-3 py-2 text-body-sm text-[var(--ink)] hover:border-[var(--ink-muted)] hover:bg-[var(--fill-2)] reticle"
    >
      <Avatar
        userId={myPresence.userId ?? myUserId}
        avatarV={myAvatarV === undefined ? myPresence.avatarV : myAvatarV}
        size="sm"
      />
      <span className="text-caption text-[var(--ink-muted)]">{total} na sala</span>
      <ChevronDownIcon
        className={`ml-auto h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function PresenceList({
  expanded,
  myUserId,
  myName,
  myAvatarV,
}: {
  expanded: boolean;
  myUserId: string;
  myName: string;
  myAvatarV?: number | null;
}) {
  const others = useOthers();
  const [myPresence] = useMyPresence();
  const byUser = uniqueOthers(others, myPresence.userId ?? myUserId);
  const myId = myPresence.userId ?? myUserId;

  return (
    // A lista fica sempre montada e só troca de display: com render
    // condicional, `aria-controls` apontava para um id que não existia
    // enquanto recolhida (o valor de um `aria-controls` tem que resolver
    // sempre). `hidden` nativo não bastaria — o `display: flex` do Tailwind
    // vence a regra `[hidden]` do browser.
    <ul
      id="presence-list"
      className={`max-h-[30dvh] flex-col gap-2 overflow-y-auto ${expanded ? "flex" : "hidden"}`}
    >
      <li className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--fill-1)] px-3 py-2 text-body-sm text-[var(--ink)]">
        <Avatar
          userId={myId}
          avatarV={myAvatarV === undefined ? myPresence.avatarV : myAvatarV}
          size="md"
        />
        <span className="min-w-0 truncate">{myPresence.name || myName}</span>
        <span className="text-caption text-[var(--ink-muted)]">(você)</span>
      </li>
      {[...byUser].map(([userId, { name, avatarV }]) => (
        <li
          key={userId}
          className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--fill-1)] px-3 py-2 text-body-sm text-[var(--ink)]"
        >
          <Avatar userId={userId} avatarV={avatarV} size="md" />
          <span className="min-w-0 truncate">{name}</span>
        </li>
      ))}
    </ul>
  );
}