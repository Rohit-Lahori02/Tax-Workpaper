# Tax Workpaper

A web-native tax workpaper for the Miraflores case study: the record that proves one household's computed return is right. It loads the pipeline packet as delivered, never edits it, and keeps everything people add as an append-only ledger of facts.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # paste your Neon DATABASE_URL
pnpm dev
```

The packet lives at `data/packet.json`. Set `PACKET_PATH` to load a different one.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server at http://localhost:3000 |
| `pnpm test` | Packet schema, reference parsing and integrity checks |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations for the facts ledger |

## Deploy (Vercel)

The app is a standard Next.js project; nothing in it is Vercel-specific.

1. Push `main` to GitHub (already at github.com/Rohit-Lahori02/Tax-Workpaper).
2. On vercel.com choose **Add New → Project**, import the repository, keep the defaults (framework Next.js, build `pnpm build`, install `pnpm install`).
3. Under **Environment Variables** add `DATABASE_URL` with the Neon connection string from `.env.local` (Production and Preview). Nothing else is required; `PACKET_PATH` and `DATABASE_DRIVER` stay unset.
4. Deploy. The first build runs `next build`; every later push to `main` redeploys.

Or from a terminal, once per machine:

```bash
npm i -g vercel
vercel login
vercel link
vercel env add DATABASE_URL production
vercel --prod
```

The ledger schema is already applied to the Neon database (`drizzle/0000_fancy_red_shift.sql`); a fresh database needs `pnpm db:migrate` with `DATABASE_URL` set before the first visit.

## Submission documents

- `docs/one-pager.md` – core idea and data model (also the live doc linked there)
- `docs/errors-found.md` – the twelve errors the checks found in the packet, with evidence and tax effect
- `docs/video-script.md` – walkthrough script by role

## Layout

- `src/lib/packet` – Zod schema, loader, forward/reverse indexes, reference resolution
- `src/lib/refs.ts` – the packet's reference formats and where each one links
- `src/lib/roles.ts`, `src/lib/mask.ts` – roles, clearance and sensitive-data masking
- `src/db` – Drizzle schema for the ledger
- `src/app` – Next.js app router pages
