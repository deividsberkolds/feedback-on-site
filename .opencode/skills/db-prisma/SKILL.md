---
name: db-prisma
description: Use when changing the database schema, running Prisma migrations, generating the Prisma client, querying PostgreSQL, or switching between local Docker and Supabase/Neon. Covers the Prisma 7 + @prisma/adapter-pg setup specific to this template.
---

# db-prisma

This skill covers the Prisma 7 + `@prisma/adapter-pg` setup as wired in **this** template.
Prisma 7 changed several things from older guides/training data — follow this, not generic Prisma docs.

## The change-loop (schema → migration → client → verify)

1. Edit `prisma/schema.prisma` (add/modify a `model`).
2. Run `pnpm db:migrate --name <descriptive>` — this **creates** the migration SQL, **applies** it
   to the DB, and **regenerates** the Prisma client into `./generated/prisma`.
3. Verify: `pnpm db:studio` (GUI at http://localhost:5555) or `curl http://localhost:3000/api/todos/`.

Notes:
- `prisma generate` also runs automatically on `pnpm install` (postinstall script), so the client
  exists after a fresh clone/install.
- If you only changed the client output or generators (no schema change), run `pnpm db:generate`.

## Where things live (template-specific)

| Concern | Location |
| --- | --- |
| Schema (models + `datasource` provider) | `prisma/schema.prisma` |
| DB connection URL | `prisma.config.ts` → `datasource.url = env("DATABASE_URL")`, loaded via `import "dotenv/config"` |
| Generated client (gitignored, recreated) | `./generated/prisma` |
| Runtime singleton | `src/lib/prisma.ts` (`PrismaPg` adapter, hot-reload-guarded) |
| Env validation gate | `src/lib/env.ts` (zod — `DATABASE_URL` required, fails fast) |
| Migrations | `prisma/migrations/` (committed) |

**Always** import `prisma` from `@/lib/prisma` in app code. Never instantiate `PrismaClient`
directly elsewhere — it breaks dev hot-reload (the singleton guard exists for a reason).

The generated client is imported as `from "../../generated/prisma/client"` — note it is a **file**,
there is no `index.ts` barrel.

## Gotchas an AI gets wrong from training data

These diverge from most Prisma training data (which assumes Prisma ≤6 / `prisma-client-js`):

- **No query-engine binary.** This template uses the `@prisma/adapter-pg` driver adapter, so
  Prisma ships no Rust query-engine binary. Do not reference `queryEngineType` or binary targets.
- **Generator is `prisma-client`, not `prisma-client-js`.** The ESM-first generator. It requires
  an `output` path (here `../generated/prisma`); without it, generation fails.
- **`datasource.url` does NOT belong in `schema.prisma`.** In Prisma 7 the URL lives in
  `prisma.config.ts` (`datasource: { url: env("DATABASE_URL") }`). The schema's `datasource db`
  block contains only `provider = "postgresql"`. Do not add a `url` field there.
- **The client is gitignored.** A fresh clone has no `generated/` until `pnpm install` (postinstall)
  or `pnpm db:generate` runs. If TypeScript complains about missing types, run `pnpm db:generate`.
- **`pnpm build` needs a valid `DATABASE_URL`.** `src/lib/env.ts` validates env at boot via zod;
  a missing/malformed `DATABASE_URL` fails the build. Set it in `.env` before building.
- **Standalone build bundles the client.** `output: 'standalone'` traces the generated client into
  `.next/standalone`. If you change the schema inside a built Docker image, rebuild — the bundled
  client won't update from `prisma generate` alone in the runner stage.

## Commands

| Script | Does |
| --- | --- |
| `pnpm db:generate` | Regenerate the client into `./generated/prisma` (no DB needed) |
| `pnpm db:migrate` | `prisma migrate dev` — create + apply a migration + regenerate (dev only) |
| `pnpm db:push` | `prisma db push` — push schema to DB **without** a migration (prototyping only) |
| `pnpm db:studio` | Prisma Studio GUI at http://localhost:5555 |

## dev vs prod migrations

- **Dev:** `pnpm db:migrate --name <desc>` — creates the migration file, applies it, regenerates
  the client. Use while developing.
- **Prod / CI / release:** `pnpm dlx prisma migrate deploy` — applies **pending** migrations only,
  never creates new ones. Run this on deploy.
- **Reset dev (destructive):** `pnpm dlx prisma migrate reset` — drops and recreates the DB from
  all migrations. Never run against prod.
- **`db:push` vs `migrate`:** `db:push` syncs schema to DB with no migration history — fine for
  prototyping, never use in prod. Prefer `db:migrate` so you get versioned migration files.

## Local Docker vs managed Postgres (condensed)

See README for full detail; the template is provider-agnostic (Prisma + `DATABASE_URL` is the only coupling).

- **Local Docker:** `docker compose up -d db` (Postgres 16, persistent volume).
  `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/basedb?schema=public"`.
  Heads-up: the compose `db` service binds host port 5432 — if a host Postgres is already running
  on 5432, either use the host one or remap the compose port.
- **Managed (Supabase/Neon/Railway/etc.):** copy the direct connection string into `DATABASE_URL`.
  - **Migrations** must use the **direct** connection (port 5432), not the pooler.
  - **Runtime** (serverless/edge) can use the **pooler** (Supabase: port 6543, add
    `?pgbouncer=true&connection_limit=1`). Keep the direct URL in `.env` for the CLI.
  - The `@prisma/adapter-pg` driver works on the edge, so this template is edge-ready.

## Post-change checklist

- [ ] Migration file created under `prisma/migrations/` (if using `db:migrate`)
- [ ] `./generated/prisma` regenerated (happens automatically with `db:migrate` / `install`)
- [ ] `pnpm typecheck` passes (confirms client types match your schema)
- [ ] Verified via `pnpm db:studio` or an API route returning the new/changed data
- [ ] If deploying: rebuild the image (standalone bundles the generated client)

## Reminder

The `Todo` model in `prisma/schema.prisma` and the `/api/todos` route are sample placeholders.
Delete both (and the generated migration, if you want a clean history) when starting your real schema.
