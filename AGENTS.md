# AGENTS.md

Project-specific guidance for AI agents working on this codebase.

## What this is

**Feedback on Site** — collect pinpoint feedback on any web page from your clients.
Admins create a project (a site), spin up a review session, and send a shareable token link to
a client. The client opens the link, the target page is rendered inside the app via a same-origin
proxy (`/api/proxy`), they click elements to drop Word-style comments (XPath + element screenshot
captured), and on "Submit review" the admin receives an email digest (Resend).

Stack: Next.js 16 (App Router, Turbopack, standalone, trailingSlash), Tailwind v4, shadcn/ui,
Prisma 7 + `@prisma/adapter-pg`, NextAuth v5 (Credentials, JWT), Resend, html2canvas.

## First commands

```bash
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET, (optional) RESEND_API_KEY
pnpm install                # postinstall runs `prisma generate` + copies html2canvas into public/
pnpm db:migrate             # apply the init migration
pnpm dev                    # http://localhost:3000  → first visit to /login creates the admin
```

`AUTH_SECRET` is required — generate with `openssl rand -base64 32`. Without `RESEND_API_KEY`,
emails (magic link / digest) are logged to the server console instead of sent.

## First-run setup

1. Visit `http://localhost:3000/login` — because no users exist, the page shows a **Set up
   admin** form. Create your admin account (email + password). Optionally pre-set
   `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` in `.env` to auto-create it on first
   visit instead.
2. Create a **Project** at `/projects` (name + the URL to review).
3. Create a **Review session** on the project detail page → copy the `/share/<token>` link.
4. Open the share link in another browser (incognito) to act as the client. Click **Start
   reviewing**, then click anywhere on the rendered page to drop a comment.
5. When the client clicks **Submit review**, you receive an email digest (or console log in
   dev). View all comments with screenshots at
   `/projects/<id>/sessions/<sessionId>`.

## Decision guide

| I want to… | Do this |
| --- | --- |
| change the DB schema / tables | use the **`db-prisma`** skill; `pnpm db:migrate --name <desc>` |
| add an API endpoint | `src/app/api/<name>/route.ts`; for DB routes set `export const dynamic = "force-dynamic"` (see `/api/comments`) |
| add a UI component | `pnpm dlx shadcn@latest add <name>` (components land in `src/components/ui/`) |
| validate env safely | import `env` from `@/lib/env.ts` — never read `process.env` directly in app code |
| switch local Postgres → Supabase/Neon | set `DATABASE_URL` to the managed connection; see README "Track B" |
| deploy | `docker build -t feedback-on-site .`; on host set `DATABASE_URL`, run `prisma migrate deploy` on release |
| tweak the page proxy / annotator | `src/app/api/proxy/route.ts` (rewrites HTML+CSS, injects the annotator) and `public/_annotator/client.js` (the in-iframe pin/popover/screenshot script) |

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
- **NextAuth v5** (Credentials provider, JWT sessions). Edge-safe config in `src/auth.config.ts`
  (no Prisma/bcrypt) is used by `src/proxy.ts`; the full config in `src/auth.ts` adds the real
  `authorize`. Keep this split — importing Prisma into the edge proxy bundle breaks it.
- **Resend** for email (digest on submit). Without `RESEND_API_KEY`, mail is logged to console.
- **html2canvas** (bundled at `public/_annotator/html2canvas.min.js`, kept in sync by `postinstall`)
  runs inside the proxied iframe to capture per-comment element screenshots.
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
- The auth split matters: `src/auth.config.ts` (edge-safe, imported by `src/proxy.ts`) must NOT
  import Prisma or bcrypt. `src/auth.ts` imports Prisma and runs in the Node route handler.

## Env vars

- `DATABASE_URL` — Postgres connection string. Set in `.env` (Prisma CLI reads it via
  `import "dotenv/config"` in `prisma.config.ts`; Next.js also reads `.env`).
  Local-local overrides go in `.env.local` (gitignored). See `.env.example`.
- `AUTH_SECRET` — required (>=16 chars). Generate with `openssl rand -base64 32`.
- `APP_BASE_URL` — public base URL (used in the digest email's dashboard link).
- `RESEND_API_KEY` — optional; omit to log emails to console in dev.
- `MAIL_FROM` — From address for outgoing mail.
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — optional; auto-create the admin on
  first visit to `/login` (otherwise the setup form does it).

## Important

- This is Next.js 16 — it may differ from prior training data. If unsure about an API, check
  `node_modules/next/dist/docs/`. In particular, Next 16 **renamed `middleware.ts` to `proxy.ts`**
  (export `proxy`, not `middleware`); this project uses `src/proxy.ts`.
- `output: 'standalone'` means `pnpm start` runs `node .next/standalone/server.js`
  (not `next start`). A `postbuild` step copies `.next/static` + `public` into
  `.next/standalone` so the standalone server serves assets. The Docker image just copies
  `.next/standalone`. The generated Prisma client is bundled by the standalone tracer.
