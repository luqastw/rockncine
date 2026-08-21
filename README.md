# RockNCine

Synchronized watch-party rooms. Paste a video link, share the room code, and everyone's player stays in sync. Live chat runs alongside.

Live at [rockncine.vercel.app](https://rockncine.vercel.app).

## Features

- **Rooms** — create a room, get a short 8-character code (no `0/O`, `1/I/L`, `U` — easy to read aloud), share the link or code
- **Synchronized playback** — play, pause, and seek propagate to every participant in real time via Liveblocks, with drift correction against clock skew
- **Multiple video sources** — YouTube and Vimeo (full sync via their player SDKs), direct media (`.mp4`/`.webm`/`.m3u8`, `.m3u8` via `hls.js`), Google Drive previews, and a generic iframe fallback for anything else (load-only, no sync — the source doesn't expose a control API)
- **Live chat** — ephemeral, scoped to the room session, not persisted to the database
- **Presence** — see who else is in the room in real time
- **Custom player chrome** — native player controls are hidden in favor of a consistent overlay bar (play/pause, seek, volume, fullscreen)
- **Theater mode** — in fullscreen, shrink the video to make room for chat and presence alongside it
- **Auth** — email/password only, no OAuth

## Stack

| Component | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript, React 19 |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth (Credentials provider, JWT sessions) |
| Real-time | Liveblocks (storage, broadcast events, presence) |
| Styling | Tailwind CSS 4 |
| Direct media playback | hls.js |
| Vimeo playback | @vimeo/player |
| Tests | Vitest |
| Deployment | Vercel + Neon Postgres + Liveblocks |

## Data model

- `User` — email, password hash, name
- `Room` — invite code, owner, last-loaded video (source/URL/embed URL, so reopening a room shows the last video even though Liveblocks storage is ephemeral between active sessions)
- `RoomMember` — join table between users and rooms

No `Message` model — chat is not persisted.

## Running locally

Requires Node.js, a PostgreSQL instance, and a [Liveblocks](https://liveblocks.io) project (free tier works).

```bash
git clone https://github.com/luqastw/rockncine.git
cd rockncine
npm install
```

Start a local Postgres if you don't have one:

```bash
docker run --name rockncine-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16-alpine
```

Copy the env file and fill it in:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | random secret, e.g. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` in development |
| `LIVEBLOCKS_SECRET_KEY` | from your Liveblocks project (server-side only, never exposed to the client) |

Apply migrations and start the dev server:

```bash
npx prisma migrate deploy
npm run dev
```

The app runs at `http://localhost:3000`.

## Testing

```bash
npm test
```

Vitest, covering video source detection, room code generation, and the playback controller abstraction.

## License

MIT
