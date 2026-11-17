import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Divider } from "@/components/chrome/Divider";
import { PageShell } from "@/components/chrome/PageShell";
import { CardNumeral } from "@/components/chrome/Pattern";
import { ProductPreview } from "@/components/chrome/ProductPreview";
import { Reveal } from "@/components/chrome/Reveal";
import {
  ArrowRightIcon,
  ChatIcon,
  ClockIcon,
  ScreenIcon,
  UsersIcon,
} from "@/components/room/player/icons";
import { ButtonLink } from "@/components/ui/Button";

const PASSOS = [
  { titulo: "Crie uma sala", apoio: "Um clique e a sala está pronta, com um link só seu." },
  { titulo: "Cole um link", apoio: "YouTube, Vimeo ou mídia direta. O player carrega para todos." },
  { titulo: "Chame a turma", apoio: "Quem abrir o link entra na hora e assiste no mesmo instante." },
];

const RECURSOS = [
  {
    Icon: ClockIcon,
    titulo: "Player em sincronia",
    apoio: "Play, pause e seek de uma pessoa viram de todas, com correção automática de desvio.",
  },
  {
    Icon: ChatIcon,
    titulo: "Chat ao lado do vídeo",
    apoio: "Mensagens, reações e avisos de quem entrou, sem sair da sala.",
  },
  {
    Icon: UsersIcon,
    titulo: "Presença ao vivo",
    apoio: "Veja quem está na sala e quem está digitando, em tempo real.",
  },
  {
    Icon: ScreenIcon,
    titulo: "Compartilhe a tela",
    apoio: "Sem link? Transmita uma janela ou aba para a turma assistir junto.",
  },
];

const SELOS = ["YouTube, Vimeo e mídia direta", "Sem instalar nada", "Sala pronta em um clique"];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/rooms");

  return (
    <PageShell
      width="full"
      nav="public"
      fog
      actions={
        <>
          <ButtonLink href="/login" variant="ghost" size="sm">
            Entrar
          </ButtonLink>
          <ButtonLink href="/register" variant="outline" size="sm">
            Criar conta
          </ButtonLink>
        </>
      }
    >
      <section className="relative">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 pt-28 pb-20 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-36 lg:pb-28">
          <Reveal className="flex flex-col items-start gap-8">
            <p className="text-caption font-medium tracking-wide text-[var(--gold-hi)]">
              Sala de cinema compartilhada
            </p>
            <h1 className="text-display font-semibold text-gold">
              Assista junto, no mesmo instante
            </h1>
            <p className="max-w-xl text-[1.0625rem] leading-7 text-[var(--ink-muted)] sm:text-lg sm:leading-8">
              Cole um link, todo mundo entra na mesma sala e o play, o pause e o seek vão junto.
              Chat ao vivo, presença e o mesmo quadro para todos.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <ButtonLink href="/register" variant="primary" size="lg">
                Começar agora
                <ArrowRightIcon className="size-5" />
              </ButtonLink>
              <ButtonLink href="/login" variant="outline" size="lg">
                Já tenho conta
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-body-sm text-[var(--ink-muted)]">
              {SELOS.map((selo) => (
                <li key={selo} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 rotate-45 bg-[var(--gold)]" />
                  {selo}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal index={1} className="w-full lg:justify-self-end">
            <ProductPreview />
          </Reveal>
        </div>
      </section>

      <Divider />

      <section className="band">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-20 sm:px-10 lg:py-28">
          <Reveal className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-h2 font-semibold text-gold">Como funciona</h2>
            <p className="text-body text-[var(--ink-muted)]">
              Do clique inicial ao play coletivo em três passos curtos.
            </p>
          </Reveal>
          <ol className="grid gap-6 md:grid-cols-3">
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="flex">
                <Reveal
                  index={i}
                  className="frame frame-lg frame-hover flex w-full flex-col gap-5 p-7 pb-9 sm:p-9"
                >
                  <CardNumeral value={`0${i + 1}`} />
                  <h3 className="text-card font-semibold text-[var(--ink)]">{passo.titulo}</h3>
                  <p className="text-body text-[var(--ink-muted)]">{passo.apoio}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Divider />

      <section>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-20 sm:px-10 lg:py-28">
          <Reveal className="flex max-w-2xl flex-col gap-4">
            <h2 className="text-h2 font-semibold text-gold">Tudo para assistir junto</h2>
          </Reveal>
          <ul className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {RECURSOS.map(({ Icon, titulo, apoio }, i) => (
              <li key={titulo} className="flex">
                <Reveal
                  index={i}
                  className="flex w-full flex-col gap-4 border-t border-[var(--gold-edge)] pt-6"
                >
                  <Icon className="size-8 text-[var(--gold)]" />
                  <h3 className="text-heading font-semibold text-[var(--ink)]">{titulo}</h3>
                  <p className="text-body text-[var(--ink-muted)]">{apoio}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Divider />

      <section className="band">
        <Reveal className="mx-auto flex w-full max-w-7xl flex-col items-start gap-8 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:py-24">
          <h2 className="max-w-2xl text-h2 font-semibold text-gold">
            Sua sala está a um clique de distância
          </h2>
          <ButtonLink href="/register" variant="primary" size="lg">
            Criar minha sala
            <ArrowRightIcon className="size-5" />
          </ButtonLink>
        </Reveal>
      </section>

      <footer className="px-6 pt-10 pb-44 text-center text-body-sm text-[var(--ink-muted)] sm:pb-48">
        Rockncine · Feito para assistir junto
      </footer>
    </PageShell>
  );
}
