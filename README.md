# Tax Workpaper

A web-native tax workpaper for the Miraflores case study: the record that proves one household's computed return is right, lets people change it without editing it, and answers for it later. It loads the pipeline packet as delivered, never writes to it, and keeps everything people add as an append-only ledger of facts. Every screen is a view over the packet plus that ledger.

## Documents

- `docs/one-pager.md` – core idea and data model
- `docs/approach-and-decisions.md` – how the work was approached and the key decisions, with the alternatives weighed and what each costs
- `docs/errors-found.md` – the twelve errors the independent checks found in the packet, with evidence and estimated tax effect

## Run locally

Requires Node 20+, pnpm and a Postgres database for the ledger (a hosted Neon database or the local one in `docker-compose.yml`).

```bash
pnpm install
cp .env.example .env.local      # set DATABASE_URL
pnpm db:migrate                 # creates the facts table (once per database)
pnpm dev                        # http://localhost:3000
```

For a local database instead of a hosted one:

```bash
docker compose up -d
# then in .env.local: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workpaper
```

The packet lives at `data/packet.json`; set `PACKET_PATH` to load a different one. The role switcher in the top bar stands in for login: pick any staff member or client to see the file as they would.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | 53 unit tests over the projections: ledger folding, working return, checks, sign-off hashes, filing lifecycle, standards, search |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm tsx scripts/checks-report.ts` | Prints the checks' findings against the current return |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations for the facts ledger |

## Layout

- `data/packet.json` – the pipeline packet, read-only
- `src/lib/packet` – Zod schema, loader, forward and reverse indexes, reference resolution, page marks
- `src/lib/refs.ts` – the packet's reference formats and where each one links
- `src/lib/facts` – fact kinds, the ledger projection, server actions that write facts, permission guards
- `src/lib/checks` – the thirty-one independent checks
- `src/lib/effective.ts`, `src/lib/signoff.ts`, `src/lib/season.ts`, `src/lib/notice.ts`, `src/lib/completeness.ts` – working return, sign-off hashes and filing gates, filing lifecycle and simulated agency, notice packages, completeness
- `src/lib/roles.ts`, `src/lib/mask.ts`, `src/lib/permissions.ts` – roles, clearance, masking and what each role may do
- `src/db` – Drizzle schema for the ledger
- `src/app` – Next.js app router pages; `src/components` – shared UI
- `drizzle/` – the ledger migration
