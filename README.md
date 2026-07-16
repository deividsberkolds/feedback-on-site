# Next.js + PostgreSQL base template

A copy-and-go starter: Next.js 16 (App Router, Turbopack, standalone), Tailwind v4,
shadcn/ui, Prisma 7 (driver adapter, no query engine), typed env, and quality tooling.
Bring your own Postgres — local Docker **or** Supabase/Neon/etc.

## What's pre-installed

- **Next.js 16** — App Router, React 19, `output: 'standalone'`, `trailingSlash: true`
- **Tailwind CSS v4** + **shadcn/ui** (`button`, `card`, `input`, `label`) in `src/components/ui/`
- **Prisma 7** — ESM `prisma-client` generator + `@prisma/adapter-pg` driver adapter
- **Typed env** via `zod` (`src/lib/env.ts`) — fails fast on a missing/malformed `DATABASE_URL`
- **Prettier**, **ESLint**, **Husky**, **lint-staged**, **Prisma Studio**
- Sample `Todo` model + `/api/health` and `/api/todos` routes to prove the wiring
- `Dockerfile` (standalone) + `docker-compose.yml` (local Postgres)

## AI onboarding

This template ships agent guidance that an AI assistant picks up automatically:

- **`AGENTS.md`** — editor-agnostic orientation (what's pre-wired, commands, conventions, env).
  Loaded as instructions by opencode, Claude Code, Cursor, etc.
- **`.opencode/skills/db-prisma/SKILL.md`** — an opencode project skill with the Prisma change-loop
  and the Prisma 7 / `@prisma/adapter-pg` gotchas specific to this template. Triggers on schema /
  migration / client / DB-provider keywords.

To add more skills, drop a `SKILL.md` (with `name` + `description` frontmatter) into
`.opencode/skills/<name>/`. opencode auto-discovers `.opencode/skills/**/SKILL.md`; no config needed.

## Prerequisites

- Node.js >= 18.18 (built/tested on 20/22/24)
- pnpm (`corepack enable`)
- A Postgres database — pick **Track A** or **Track B** below

## Quick start

```bash
cp .env.example .env        # then edit DATABASE_URL (see Track A or B)
pnpm install                # also runs `prisma generate` (postinstall)
pnpm db:migrate             # create + apply the initial migration
pnpm dev                    # http://localhost:3000
```

Verify the DB wiring:

```bash
curl http://localhost:3000/api/health/
curl http://localhost:3000/api/todos/
```

## Database setup

> The template is provider-agnostic: Prisma + `DATABASE_URL` is the only coupling.
> Local Docker and Supabase are documented below; Neon, Railway, Render, etc. work the same way.

### Track A — local Postgres via Docker (recommended quick-start)

Starts Postgres 16 with a persistent volume and a healthcheck:

```bash
docker compose up -d db
```

Use this in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/basedb?schema=public"
```

- Stop: `docker compose down` (keeps data). Wipe data: `docker compose down -v`.

### Track B — Supabase (managed Postgres)

1. Create a project at [supabase.com](https://supabase.com).
2. Project Settings → Database → **Connection string**.
3. Use the **direct connection** (port `5432`) for migrations:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
```

Gotchas:

- **Migrations** (`prisma migrate dev`) must use the **direct** connection (port 5432), not the pooler.
- **Runtime** (serverless/edge) can use the **pooler** (Transaction mode, port `6543`, add
  `?pgbouncer=true&connection_limit=1`). Keep the direct URL in `.env` for the CLI; switch to the
  pooler only for deployed runtime if you hit connection limits.
- Prisma's driver adapter (`@prisma/adapter-pg`) works on the edge, so this template is edge-ready.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build → `.next/standalone` |
| `pnpm start` | Serve the production build |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm format` | Prettier write |
| `pnpm validate` | format + lint + typecheck |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` | Create/apply a migration |
| `pnpm db:push` | Push schema without a migration |
| `pnpm db:studio` | Prisma Studio GUI |

## Project structure

```
prisma/
  schema.prisma        # models + datasource (provider=postgresql)
prisma.config.ts        # schema/migrations paths, datasource.url = DATABASE_URL
generated/prisma/       # gitignored client output (recreated by `prisma generate`)
src/
  app/
    api/health/route.ts # GET /api/health/
    api/todos/route.ts  # GET/POST /api/todos/  (sample CRUD)
    error.tsx, loading.tsx, not-found.tsx, page.tsx, layout.tsx, globals.css
  components/ui/        # shadcn components (button, card, input, label)
  lib/
    env.ts              # zod-validated env (import `env` from here)
    prisma.ts           # PrismaClient singleton (PrismaPg adapter)
Dockerfile              # standalone multi-stage build
docker-compose.yml      # local Postgres (db service)
.env.example            # documented env template
```

## Notes

- The `Todo` model and `/api/todos` route are **sample placeholders** — delete them when you
  start your real schema.
- The generated Prisma client lives in `./generated/prisma` (gitignored). It is recreated on
  `pnpm install` (postinstall) and `pnpm db:generate`. Import it as
  `from "../../generated/prisma/client"` (it is a file, not a directory with an index).
- Env is validated at boot via `src/lib/env.ts`; `pnpm build` requires a valid `DATABASE_URL`.
- To add UI components: `pnpm dlx shadcn@latest add <name>`.
- To create a production image: `docker build -t nextjs-base .`
  (requires the build to generate the Prisma client, so keep `prisma/` in the build context).
