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

**If you are new to this repository, start with `docs/HANDOVER.md`.** It carries the
current state, the remaining plan, the traps that have already cost time, and the two
deliberate rule exceptions that look like mistakes. Keep it current: when you finish a
phase or discover a trap, the next person learns it there.

## Stack

| Concern    | Choice                                               |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 App Router, React 19.2, TypeScript        |
| Database   | PostgreSQL 17 via Drizzle ORM                        |
| Cache      | Redis, for sessions and rate limiting                |
| Styling    | Tailwind CSS 4 with CSS-variable design tokens       |
| Charts     | Chart.js, one board per subject, never one dashboard |
| Auth       | Better Auth, invite-only, TOTP two-factor            |
| Automation | n8n on the same VPS, over the internal network only  |

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
   writes happen in Server Actions. Two exceptions exist, both deliberate: the
   HMAC-signed n8n integration routes, reachable on the internal Docker network only,
   and `/lead-images/[id]/[variant]`, because an `<img>` tag issues its own GET and no
   component can hand it bytes. That route is read-only, checks the session and
   `leads:read` inside the handler, and looks the storage key up by id rather than
   taking a path from the URL. Do not add a third without the same kind of reason.
2. **Never read `process.env` directly.** Import `{ env }` from `@/lib/env`, which
   is validated at startup. ESLint enforces this. `@/lib/env` is `server-only`, and
   so is everything that imports it - including `@/lib/time`. A `'use client'` file
   that reaches either, even through three layers of innocent-looking helpers, fails
   the build. When a client component needs a constant that lives beside server code,
   put the constant in its own dependency-free module rather than importing the
   server module for it: see `features/analytics/presets.ts`.
3. **Validate every input with Zod at the trust boundary**, inside the Server
   Action, before it reaches the database. A Server Action is a public HTTP
   endpoint whatever it looks like in the code.
4. **Every Server Action starts with an authorisation check.** Being unreachable
   from the UI is not access control.
5. **Store instants as `timestamptz` in UTC.** Convert to the business timezone
   only for display or for grouping by day, using `@/lib/time`. Qatar is UTC+3.
6. **Soft-delete business records** (`deleted_at`), and write an `activity_log`
   row for anything that changes data. `lead_images` is the one exception: deleting a
   photo unlinks the file, because a soft delete that leaves the bytes on disk makes
   the button a lie. The log entry is the record.
7. **Phone numbers are the customer identity**, normalised to E.164.
8. **Never log a secret, session token, or full phone number.** The logger
   redacts known field names, but do not rely on that alone.
9. **The back office is a standard dashboard; the public site is the brand.**
   Details below.

## Two design systems

The back office follows ordinary dashboard convention: **Inter** throughout,
14px body text, 6px corners, sentence-case labels, tabular figures. The public
site keeps the brand's editorial pairing - Cormorant Garamond, Jost, Marcellus -
with square corners and wide uppercase labels. **Both use the same brand
colours.**

One set of components serves both, so:

- Never hardcode a font family, border radius or shadow in a component. Use
  `font-body` / `font-display` / `font-label`, `rounded-control` /
  `rounded-panel`, `shadow-panel` / `shadow-overlay`, and the `eyebrow` /
  `label-caps` utilities. Each resolves through the active theme.
- Add anything new to `ThemeTokens` in `src/lib/theme/tokens.ts` first, then
  mirror it into `src/app/globals.css`. The tests fail if the two disagree, or
  if a token is unreachable from any component.
- `BrandMark` is the one deliberate exception: a logotype names Marcellus
  directly, because identity should not change with the theme.

## Analytics

Reports are **boards**: one subject per page, at `/analytics/<board>`. Demand exists;
money, stock and orders are declared in `src/features/analytics/boards.ts` and shown
as planned. Never add a chart about one subject to another subject's board, and never
grow the dashboard into a single page of everything - that is the failure this
structure exists to prevent.

- The presentation layer is shared: `range.ts` (period and previous-period),
  `slice.ts` (Top-N with an honest total), `buckets.ts` (grain and zero-filled
  spines), `components/` (the Chart.js client component and the cards).
- The SQL belongs to the domain that owns the tables: `features/leads/analytics.ts`
  for demand, and a sibling in each feature as it arrives.
- Aggregate in Postgres, never in JavaScript. Group days with `at time zone`.
- Charts take serialisable specs only, and read colour from CSS variables.
- `npm run db:demo` invents leads to look at; `npm run db:demo -- clear` removes them.

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
