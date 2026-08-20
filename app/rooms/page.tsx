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
        <form action="/rooms/new" method="POST">
          <button
            type="submit"
            className="min-h-11 w-full rounded-md bg-[var(--ember)] px-4 py-2 text-sm font-medium text-[var(--bg-void)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)] focus:ring-offset-2 focus:ring-offset-[var(--bg-void)]"
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
