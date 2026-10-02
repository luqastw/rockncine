# RockNCine

Synchronized watch-party rooms. Paste a video link, share the room code, and everyone's player stays in sync. Live chat runs alongside.

Live at [rockncine.vercel.app](https://rockncine.vercel.app).

## Features

- **Public landing page** — the root explains the product before asking for an account. The invite
  link is the whole funnel, and it used to land on a bare login screen
- **Rooms** — create a room, get a short 8-character code (no `0/O`, `1/I/L`, `U` — easy to read aloud), share the link or code. Your room list is ordered by room activity, shows what each room is playing, and paginates
- **Synchronized playback** — play, pause, and seek propagate to every participant in real time via Liveblocks. Every event carries the sender's `ts`, which is validated on arrival and used for last-write-wins ordering plus a clock-skew estimate: a follower compares the storage snapshot against *that actor's* clock, not its own, so a machine whose clock is off by seconds no longer stays permanently out of sync
- **Multiple video sources** — YouTube (full sync via the player SDK, closed captions off by default regardless of viewer language/account preference) and Vimeo (full sync via their player SDK), direct media (`.mp4`/`.webm`/`.m3u8`, `.m3u8` via `hls.js`), Google Drive previews, and a generic iframe fallback for anything else (load-only, no sync — the source doesn't expose a control API)
- **Live chat** — ephemeral, scoped to the room session, not persisted to the database; system messages announce when someone joins or leaves (debounced against reconnects/refreshes). Every broadcast payload is validated at the boundary (`lib/chat-event.ts`, `lib/playback/events.ts`) — a malformed message from one member is dropped, not rendered
- **Captions** — off by default, with an explicit toggle in the player bar. Only the YouTube source exposes caption control; the button is hidden (not shown-and-inert) elsewhere
- **Presence** — see who else is in the room in real time, collapsed to a count by default with the full list one click away
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
| Tests | Vitest 4 + Testing Library (jsdom) |
| CI | GitHub Actions — runs the full gate on push/PR |
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
npm run gate
```

`npm run gate` is the single entry point, and it is what CI runs on every push and pull request. It
runs, in this order: `next typegen` → `tsc --noEmit` → `eslint .` → `vitest run` → `next build`.
The order matters — `tsc` depends on `next-env.d.ts` and `.next/types/**`, which are generated and
gitignored, so on a clean clone it fails with `Cannot find name 'LayoutProps'` until `next typegen`
(or a build) has run.

The script also normalizes two environment traps that cost real debugging time:

- `NODE_ENV=production` makes `npm ci` silently skip devDependencies (no `vitest`, no `eslint`, no
  `@types/node`), and makes React resolve its production build — where `act` is not exported, so
  React Testing Library dies with `React.act is not a function` before running a single test.
- `NODE_ENV=development` makes `next build` fail while prerendering `/_global-error`.

What the suite covers: video source detection, room code generation, the synchronization core
(`lib/playback/` — event validation with the timestamp plausibility band, last-write-wins ordering,
clock-skew estimation and its TTL), the playback clock store and its render-isolation contract,
playback quality preferences and their hydration contract, the shared focus trap, chat payload
validation, the HLS buffer-length shim, the room list query and both write routes (`DELETE
/api/rooms/[code]`, `PATCH /rooms/[code]/video` — origin check and rate limit included), and the rate
limiter. The three hooks that talk to the player SDKs (YouTube / Vimeo / `<video>`) are still
untested — covering them needs the SDKs mocked.

## Bundle

Player SDKs are loaded on demand, not eagerly. `lib/hls.ts` and `lib/vimeo.ts` declare the surface
each hook uses and expose the package through `import()`, behind `isHlsUrl(url)` and the active
source. The three sync hooks are instantiated unconditionally by `RoomExperience`, so a top-level
`import` put every player in the critical path of every room.

Measured on the production build of `/rooms/[code]`: **278 KB → 108 KB gzip** of initial JavaScript.
`hls.js` (174 KB gzip) and the Vimeo SDK (8 KB) are now separate chunks fetched only when a room
actually plays an HLS manifest or a Vimeo video.

The playhead lives outside React (`hooks/usePlaybackClock.ts`). It updates at 2,5–4 Hz, and as
component state it re-rendered the room — chat, presence, header — on every tick. Only
`PlayerControls` subscribes to the playhead now; play/pause and duration are a separate
notification group.

## Security headers

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`, HSTS (production only) and disables `X-Powered-By`. There is no CSP: the room
embeds an arbitrary third-party iframe by design and runs the YouTube player SDK, so a closed
`script-src` would break the product without adding protection the origin doesn't already have —
`embedUrl` is protocol-checked at render time and every broadcast payload is validated.

## License

MIT
