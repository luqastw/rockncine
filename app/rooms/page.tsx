import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { JoinRoomForm } from "@/components/JoinRoomForm";

export default async function RoomsPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl text-[var(--ink)]">rockncine</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          {session?.user?.name ?? session?.user?.email}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          criar sala
        </h2>
        <form action="/rooms/new" method="POST" className="flex flex-col gap-2">
          <input
            type="text"
            name="name"
            maxLength={60}
            placeholder="nome da sala (opcional)"
            className="min-h-11 rounded-md border border-[var(--line)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
          />
          <button
            type="submit"
            className="min-h-11 w-full rounded-md bg-[var(--invert-bg)] px-4 py-2 text-sm font-medium text-[var(--invert-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--outline-strong)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
          >
            nova sala
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-wide text-[var(--ink-muted)]">
          entrar por código
        </h2>
        <JoinRoomForm />
      </section>
    </main>
  );
}
