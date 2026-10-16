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

## Layout

- `src/lib/packet` – Zod schema, loader, forward/reverse indexes, reference resolution
- `src/lib/refs.ts` – the packet's reference formats and where each one links
- `src/lib/roles.ts`, `src/lib/mask.ts` – roles, clearance and sensitive-data masking
- `src/db` – Drizzle schema for the ledger
- `src/app` – Next.js app router pages
