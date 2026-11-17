import { PlayIcon, VolumeHighIcon, FullscreenEnterIcon } from "@/components/room/player/icons";

const MESSAGES = [
  { who: "Marina", tint: "var(--gold)", text: "Já deu play, tá todo mundo no mesmo ponto?" },
  { who: "Caio", tint: "var(--leaf-ink)", text: "Tô aqui, entrou pelo link agora" },
  { who: "Bia", tint: "var(--fairy)", text: "Volta uns 10 segundos que eu perdi essa parte" },
];

const PRESENCE = [
  { initial: "M", tint: "var(--gold)" },
  { initial: "C", tint: "var(--leaf-ink)" },
  { initial: "B", tint: "var(--fairy)" },
  { initial: "L", tint: "var(--gold-hi)" },
];

function Avatar({ initial, tint, size = "size-7" }: { initial: string; tint: string; size?: string }) {
  return (
    <span
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--bg-surface)] text-caption font-semibold text-[var(--bg-void)]`}
      style={{ background: tint }}
    >
      {initial}
    </span>
  );
}

export function ProductPreview() {
  return (
    <figure
      data-motif="product-preview"
      className="frame frame-lg flex w-full flex-col gap-4 p-4 sm:p-5"
      style={{ "--frame-fill": "var(--bg-surface)" } as React.CSSProperties}
    >
      <figcaption className="sr-only">
        Prévia da sala: vídeo em reprodução, chat lateral e quatro pessoas presentes.
      </figcaption>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-display text-heading font-semibold text-[var(--ink)]">
              Sessão de sexta
            </span>
            <span className="text-caption text-[var(--ink-muted)]">
              <span className="font-mono tracking-wider">K7M2QX</span> · Pausado em 12:04
            </span>
          </div>
          <div className="flex -space-x-2">
            {PRESENCE.map((p) => (
              <Avatar key={p.initial} {...p} />
            ))}
          </div>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-[var(--gold-edge)] bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_30%_30%,rgb(95_158_79/0.35),transparent_70%),radial-gradient(60%_70%_at_80%_80%,rgb(217_164_65/0.22),transparent_70%)]" />
          <div className="band absolute inset-0 opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-[var(--gold)] bg-[var(--bg-surface)]/80 text-[var(--gold-hi)]">
              <PlayIcon className="size-7" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2.5 text-[var(--ink)]">
            <PlayIcon className="size-4" />
            <div className="relative h-1 flex-1 rounded-full bg-white/20">
              <span className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-[var(--gold)]" />
              <span className="absolute top-1/2 left-[38%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--gold-hi)]" />
            </div>
            <span className="font-mono text-caption">12:04</span>
            <VolumeHighIcon className="size-4" />
            <FullscreenEnterIcon className="size-4" />
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 px-1">
          {MESSAGES.map((m) => (
            <li key={m.who} className="flex items-start gap-2.5">
              <Avatar initial={m.who.slice(0, 1)} tint={m.tint} />
              <p className="text-body-sm text-[var(--ink)]">
                <span className="mr-1.5 font-medium text-[var(--ink-muted)]">{m.who}</span>
                {m.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
