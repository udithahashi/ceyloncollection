<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ceylon Collection - project conventions

A private back office for a Sri Lankan clothing import business operating in Qatar.
Its job is to capture leads from social media, understand demand, and later manage
stock, costs and shipping. There is no public-facing website yet.

Read `docs/CONCEPTS.md` for the architecture and `docs/LOCAL-DEV.md` for commands.

## Stack

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 App Router, React 19.2, TypeScript       |
| Database   | PostgreSQL 17 via Drizzle ORM                       |
| Cache      | Redis, for sessions and rate limiting               |
| Styling    | Tailwind CSS 4 with CSS-variable design tokens      |
| Auth       | Better Auth, invite-only, TOTP two-factor           |
| Automation | n8n on the same VPS, over the internal network only |

## Next.js 16 specifics that differ from older training data

These have already caused mistakes. Check them before writing code.

- **`middleware.ts` is now `proxy.ts`**, exporting a function named `proxy`. It runs
  on the Node.js runtime only; the Edge runtime is not supported there.
- **Request APIs are async.** `cookies()`, `headers()`, `draftMode()`, and the
  `params` / `searchParams` props must be awaited. There is no synchronous form.
- **`revalidateTag` takes two arguments**: `revalidateTag(tag, 'max')`. In Server
  Actions prefer `updateTag(tag)`, which expires and refreshes in the same request
  so the user sees their own write immediately.
- **`next lint` no longer exists.** Run `npm run lint`, which calls ESLint directly.
- Turbopack is the default for both `dev` and `build`.
- `next dev` writes to `.next/dev`, so a dev server and a build can run at once.

## Non-negotiable rules

1. **No browser-facing REST API.** All reads happen in Server Components; all
   writes happen in Server Actions. The only HTTP endpoints are the HMAC-signed
   n8n integration routes, which are reachable on the internal Docker network only.
2. **Never read `process.env` directly.** Import `{ env }` from `@/lib/env`, which
   is validated at startup. ESLint enforces this.
3. **Validate every input with Zod at the trust boundary**, inside the Server
   Action, before it reaches the database. A Server Action is a public HTTP
   endpoint whatever it looks like in the code.
4. **Every Server Action starts with an authorisation check.** Being unreachable
   from the UI is not access control.
5. **Store instants as `timestamptz` in UTC.** Convert to the business timezone
   only for display or for grouping by day, using `@/lib/time`. Qatar is UTC+3.
6. **Soft-delete business records** (`deleted_at`), and write an `activity_log`
   row for anything that changes data.
7. **Phone numbers are the customer identity**, normalised to E.164.
8. **Never log a secret, session token, or full phone number.** The logger
   redacts known field names, but do not rely on that alone.

## Layout

```
src/app/            routes; (admin) group is authenticated, (auth) is not
src/features/       one folder per domain area: leads, customers, taxonomy, ...
src/components/     shared UI primitives
src/db/             Drizzle schema, migrations, seeds
src/lib/            env, logger, time, auth, storage, security helpers
docker/             compose files for local dev and production
scripts/            standalone Node scripts: doctor, setup, wait-for-db
reference/          original brand and design source material - do not edit
docs/               written for a solo developer new to this stack
```

## Before you say something works

Run `npm run verify` (typecheck, lint, format check, tests). For anything
touching the database or a page, also load it in the browser and check the
server log. `npm run doctor` diagnoses environment problems.
