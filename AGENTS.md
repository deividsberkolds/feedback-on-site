# AGENTS.md

Project-specific guidance for AI agents working on this codebase.

## What this is

A copy-and-go Next.js + PostgreSQL base template. The boilerplate is installed and wired
end-to-end (Next 16, Tailwind v4, shadcn/ui, Prisma 7 + `@prisma/adapter-pg`, zod env, Docker).
The `Todo` model and `/api/todos` route are sample placeholders — delete them when starting
your real schema.

## First commands

```bash
cp .env.example .env        # set DATABASE_URL (Track A docker or Track B supabase)
pnpm install                # postinstall runs `prisma generate`
pnpm db:migrate             # create + apply the initial migration
pnpm dev                    # http://localhost:3000
```

## Decision guide

| I want to… | Do this |
| --- | --- |
| change the DB schema / tables | use the **`db-prisma`** skill; `pnpm db:migrate --name <desc>` |
| add an API endpoint | `src/app/api/<name>/route.ts`; for DB routes set `export const dynamic = "force-dynamic"` (see `/api/todos`) |
| add a UI component | `pnpm dlx shadcn@latest add <name>` (components land in `src/components/ui/`) |
| validate env safely | import `env` from `@/lib/env.ts` — never read `process.env` directly in app code |
| switch local Postgres → Supabase/Neon | set `DATABASE_URL` to the managed connection; see README "Track B" |
| deploy | `docker build -t nextjs-base .`; on host set `DATABASE_URL`, run `prisma migrate deploy` on release |

> For any schema/migration/client question, the `db-prisma` skill has the full workflow + the
> Prisma 7 / driver-adapter gotchas specific to this template.

## Commands

- `pnpm dev` — start dev server (http://localhost:3000)
- `pnpm build` — production build (Turbopack). Outputs `.next/standalone`.
- `pnpm start` — serve the production build
- `pnpm lint` — ESLint (flat config)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm format` — Prettier write
- `pnpm validate` — runs format + lint + typecheck
- `pnpm db:generate` — regenerate the Prisma client into `./generated/prisma`
- `pnpm db:migrate` — `prisma migrate dev` (create/apply migrations)
- `pnpm db:push` — `prisma db push` (push schema without a migration)
- `pnpm db:studio` — Prisma Studio (DB GUI at http://localhost:5555)

## Stack

- **Next.js 16** App Router, Turbopack, `output: 'standalone'`, `trailingSlash: true`
- React 19, TypeScript, Tailwind CSS v4 (`@import "tailwindcss"`, CSS vars in `globals.css`)
- **shadcn/ui** (v4, `base-nova` style) — components in `src/components/ui/`. The base CSS is
  provided by the `shadcn` package (`@import "shadcn/tailwind.css"`). Components use `@base-ui/react`
  (not Radix). Add more via `pnpm dlx shadcn@latest add <name>`.
- **Prisma 7** with the ESM-first `prisma-client` generator → output `./generated/prisma`
  (gitignored, recreated by `prisma generate`). Uses the `@prisma/adapter-pg` driver adapter
  (no query-engine binary, edge-friendly). DB URL lives in `prisma.config.ts` (`datasource.url`),
  NOT in `schema.prisma`.
- `zod` for env validation, Prettier + Husky + lint-staged, pnpm.

## Conventions

- Routes live under `src/app/`. API routes under `src/app/api/`. Routes end with `/` (trailingSlash).
- Import alias is `@/*` → `src/*`.
- DB access goes through the singleton in `src/lib/prisma.ts`. Never instantiate `PrismaClient`
  directly elsewhere (it breaks dev hot-reload).
- Env vars are validated in `src/lib/env.ts` — import `env` from there, do not read `process.env`
  directly in app code. Missing/invalid `DATABASE_URL` fails fast at boot.
- Secrets use `process.env` (server-side only). Never prefix DB secrets with `NEXT_PUBLIC_`.
- The generated Prisma client is imported as `from "../../generated/prisma/client"` (note: it is a
  file, there is no `index.ts`).

## Env vars

- `DATABASE_URL` — Postgres connection string. Set in `.env` (Prisma CLI reads it via
  `import "dotenv/config"` in `prisma.config.ts`; Next.js also reads `.env`).
  Local-local overrides go in `.env.local` (gitignored). See `.env.example`.

## Important

- This is Next.js 16 — it may differ from prior training data. If unsure about an API, check
  `node_modules/next/dist/docs/`.
- The `Todo` model in `prisma/schema.prisma` and the `/api/todos` route are sample placeholders —
  delete them when starting your real schema.
- `output: 'standalone'` means `pnpm start` runs `node .next/standalone/server.js`
  (not `next start`). A `postbuild` step copies `.next/static` + `public` into
  `.next/standalone` so the standalone server serves assets. The Docker image just copies
  `.next/standalone`. The generated Prisma client is bundled by the standalone tracer.
