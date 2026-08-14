# Handover

You are picking up a project that is roughly two-thirds built. This document is the
briefing: what exists, what does not, what was decided and why, and the traps that have
already cost someone an afternoon. Read it before writing code, and update it when you
finish something.

The owner is **Hashi**, a solo developer running a small clothing import business in
Qatar. He is comfortable with PHP, Laravel and MySQL, and new to Next.js, PostgreSQL,
Docker and Redis. That is why the code in this repository is commented the way it is:
the comments explain _why_, for someone who has not met these tools before. Keep writing
them that way — it is a deliberate house style, not decoration.

## Read these, in this order

| Order | Document                                      | What you get                                              |
| ----- | --------------------------------------------- | --------------------------------------------------------- |
| 1     | `AGENTS.md`                                   | The non-negotiable rules. Nine of them. Do not break them |
| 2     | This file                                     | State, plan, traps, and where the last session stopped    |
| 3     | [docs/CONCEPTS.md](CONCEPTS.md)               | The architecture and the reasoning behind every choice    |
| 4     | [docs/LOCAL-DEV.md](LOCAL-DEV.md)             | Day-to-day commands                                       |
| 5     | [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) | When something breaks                                     |
| 6     | [docs/GLOSSARY.md](GLOSSARY.md)               | Any term you or the owner does not recognise              |

`CLAUDE.md` simply points at `AGENTS.md`, so both Claude Code and Cursor read the same
rules. There is no second source of truth to keep in step.

## Confirm the state yourself

Do not trust this document over the code. Five commands, about two minutes:

```bash
npm run doctor        # Node, Docker, ports, .env.local, database reachability
npm run dev:up        # PostgreSQL on 5433, Redis on 6380 (Docker)
npm run db:migrate    # says how many migrations it applied; expect "Nothing to apply"
npm run verify        # typecheck, lint, format check, tests
npm run dev           # http://localhost:3000
```

At the last commit: **577 tests across 25 files, all passing**; `npm run build` clean;
migrations through `0005_dry_ultron` applied. `git log` is the honest history — every
commit message explains the reasoning behind that change, so `git log -p` on a feature
is often faster than reading the files cold.

**`main` is currently 5 commits ahead of `origin/main`.** The GitHub repo
(`github.com/udithahashi/ceyloncollection`) exists but the recent work is local only.
Pushing needs the owner's GitHub credentials — ask him before you push, and do not
force-push anything.

## Where the project stands

Built, working, committed:

| Area                  | State                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Local dev environment | Docker PostgreSQL 17 + Redis 7, `npm run setup`, `npm run doctor`, wait-for-db, secret-scanning pre-commit hook      |
| Configuration         | Zod-validated `@/lib/env`, `server-only`-guarded. Pino logger with redaction. `@/lib/time` for the Qatar timezone    |
| Design system         | Theme tokens for `public`, `admin-dark`, `admin-light`; SSR theme switch with no flash; contrast asserted vs WCAG AA |
| Auth                  | Better Auth, invite-only, TOTP two-factor, four roles, permission table in `@/lib/auth/roles`, activity log          |
| Taxonomy              | Ten lists, 389 seeded values, full CRUD with reorder/retire/restore, one page serves all ten via a registry          |
| Leads and customers   | Schema, list with filters, detail, edit, status changer, `customer_summary` view, E.164 phone identity               |
| Spreadsheet import    | `/leads/import`: dry-run report per row, duplicate detection, no invented taxonomy values, safe to re-upload         |
| Lead photos           | Upload, re-encode via sharp (EXIF stripped), thumbnails, `/lead-images/[id]/[variant]`, delete removes the file      |
| Analytics             | Boards, not one dashboard. Demand board built with Chart.js; money, stock and orders declared as planned             |
| Demo data             | `npm run db:demo` invents ~140 leads; `npm run db:demo -- clear` removes them                                        |

Not built yet:

- **The public website.** Nothing exists under a `(public)` route group. The brand design
  system is ready for it; the reference design is `reference/public-website.html`.
- **n8n intake.** `N8N_WEBHOOK_SECRET` is validated and a rate-limit rule exists, but
  there is no endpoint, no staging table and no review queue. No code for it at all.
- **Brand assets.** No monogram, no favicons, no empty-state illustrations. `BrandMark`
  is currently type only.
- **Deployment.** No `Dockerfile`, no `docker/compose.prod.yml`, no backup script. CI
  (`.github/workflows/ci.yml`) runs verify on push, and nothing publishes an image yet.
- **Activity log UI.** Rows are written faithfully; no page reads them. The permission
  (`activityLog:read`) already exists.
- **Money, stock, orders.** Declared in `src/features/analytics/boards.ts` and shown as
  planned. No tables, no queries.

## The plan from here

In the order the owner and I agreed. He may reprioritise — ask if it is not obvious.

### 1. n8n intake (the next phase)

**Why it matters.** Enquiries arrive as social media messages. Typing each one is the
work this system exists to remove. n8n already runs on the same Contabo VPS.

Decisions already made, so do not relitigate them:

- The endpoint is **HMAC-signed**, not session-authenticated, and reachable **only on the
  internal Docker network**. It is the one category of HTTP endpoint `AGENTS.md` permits
  besides the image route.
- Messages land in a **staging table**, not directly in `leads`. A parsed WhatsApp
  message is a guess: it may name a fabric that does not exist, or no phone number at
  all. Writing guesses straight into the table that feeds the charts would poison the
  only honest measurement of demand this business has.
- A **review queue** in the back office promotes a staged row to a lead, with the
  taxonomy resolution shown and editable. `leads.source = 'automation'` already exists
  for the rows that come out of it.
- Reuse, do not duplicate: `@/features/leads/import/lookups.ts` already resolves free
  text to taxonomy ids by name or slug, and it was written with this in mind.
- Verify the signature with `crypto.timingSafeEqual`, include a timestamp in the signed
  payload and reject anything older than a few minutes, so a captured request cannot be
  replayed.

### 2. Brand assets (needs the owner)

The owner asked for images to be generated with **Higgsfield**: GPT Image for icon-like
work, Nano Banana Pro for anything photographic. His standing instruction is explicit:
**if the Higgsfield plugin or login fails, stop and tell him — do not substitute another
tool and do not hand-roll an SVG instead.**

Wanted: a monogram for `BrandMark`, favicons and app icons, and a small set of
empty-state illustrations. Raw downloads belong in `reference/generated-raw`, which is
gitignored; committed assets go in `public/`.

### 3. Deployment to the Contabo VPS

Multi-stage `Dockerfile` (the build already uses `output: 'standalone'`),
`docker/compose.prod.yml` with app, PostgreSQL, Redis and a reverse proxy, GitHub Actions
publishing to GHCR, `nightly pg_dump` with retention, and a documented restore drill — a
backup nobody has restored is a hope, not a backup.

Two specifics that will bite otherwise:

- **`sharp` is a native module.** It was installed on Windows; the Linux container needs
  its own binaries. Build inside the image rather than copying `node_modules` in.
- **`STORAGE_LOCAL_DIR` must be a mounted volume.** Lead photos live on disk, so without
  a volume every deploy silently discards them. `npm run doctor` checks this directory is
  writable; a volume mounted as root will fail there, which is the intended warning.

### 4. Money, stock and orders

The business areas after the leads work: purchases and landed cost (goods, freight,
customs, delivery), stock on hand, and orders from enquiry to delivery. Each brings its
own tables, its own `features/<area>/analytics.ts`, and its own board. Do not add these
charts to the demand board — that separation is the point of the boards structure.

### 5. Smaller pending items

- **Trim the dashboard.** `src/app/(admin)/page.tsx` still carries a "Design foundations"
  section — a leftover component showcase from the design-system phase. It should go now
  that the page has real numbers. Consider moving it to a dev-only route if it is still
  useful.
- **Activity log page.** `activityLog:read` exists, the rows exist, nothing shows them.
- **Extract the customer upsert.** `resolveCustomer` in `src/features/leads/actions.ts`
  and the upsert inside `src/features/leads/import/commit.ts` are the same logic written
  twice. The n8n intake would make it three copies. Extract it to
  `src/features/leads/persist.ts` **when you do the intake**, so the third caller is what
  pays for the refactor.
- **Browser walkthroughs the owner has not done yet:** add a photo to a lead (a portrait
  phone photo, to confirm it is not sideways), import `public/lead-import-template.csv`,
  and look at `/analytics/demand` in both themes.

## Traps that have already caught someone

These are the expensive part of this handover. Each cost real time.

**A migration can report success and do nothing.** Drizzle applies only journal entries
whose `when` is later than the newest one already recorded. A hand-written entry
(`0004`) was given a timestamp slightly in the future, so the next generated migration
had an _earlier_ timestamp than one already applied and was skipped in silence while the
output read "up to date". The `lead_images` table was simply missing, and the first sign
was a query failing much later. `src/db/migrations.test.ts` now asserts the ordering, and
`npm run db:migrate` says how many migrations it applied. **If you hand-write a journal
entry, take its `when` from the clock, never from the future.**

**`@/lib/env` is `server-only`, and so is everything that touches it.** A client
component that reaches it — even through three innocent-looking helpers — fails the
build. This already happened once: a filter bar imported a pure-looking `summary.ts`,
which imported one date helper from `@/lib/time`, which reads the configured timezone.
The browser got a copy of the config validator and the page died with
"DATABASE_URL is required", which points at the environment rather than at the import
that does not belong. When a client component needs a constant that lives beside server
code, put the constant in its own dependency-free module —
`src/features/analytics/presets.ts` is the pattern. **Dates are formatted on the server
and passed to client components as strings.**

**Demo leads are marked `source = 'import'`.** A cleanup script that deleted by that
column wiped 140 demo leads along with its own two rows. `npm run db:demo -- clear`
matches on the `[demo]` note prefix instead. Match the marker, not the source.

**`tsx` scripts need `--conditions=react-server`.** Otherwise `server-only` throws in
plain Node. Every `db:*` and `auth:*` script in `package.json` already passes it; copy an
existing one when you add a script. Vitest handles it with an alias to
`tests/stubs/server-only.ts`.

**Server Action bodies are capped.** The limit is set from
`src/lib/images/limits.ts` in `next.config.ts` so the framework's number and the
uploader's cannot drift. Change the limits in that one module.

**`sharp`'s `withExif` ignores the Orientation tag.** A test fixture built with it proves
nothing about rotation; use `withMetadata({ orientation })`. The production code was
correct and the test was wrong, which is the more embarrassing way round.

**Prettier formats the Drizzle journal and snapshots.** After `npm run db:generate`, run
`npm run format` or `verify` will fail on files you did not write.

**PowerShell is the shell here.** No heredocs. For a multi-line commit message, write
the message to a file and use `git commit -F`. Paths with spaces need quoting.

## Deliberate deviations - do not "fix" these

Two things look like rule violations and are not. Both are documented at length in the
code and in `CONCEPTS.md`; if you think they are mistakes, read those first and then ask
the owner.

1. **`/lead-images/[id]/[variant]` is a browser-facing GET endpoint**, in a project whose
   first rule forbids them. An `<img>` tag issues its own request and no component can
   hand it bytes; the alternative is inlining photos as `data:` URLs, which defeats
   caching and lazy loading. It is read-only, it checks the session and `leads:read`
   inside the handler, it resolves the storage key from the database rather than the URL,
   and it answers 404 rather than 403 so it cannot be used to enumerate ids.
2. **`lead_images` is hard-deleted**, in a project that soft-deletes business records. The
   usual reason to remove a photo is that it should not be held at all, so a soft delete
   that leaves the bytes on disk makes the button a lie. The `activity_log` row is the
   record.

## How the owner likes to work

Worth respecting; it came up explicitly.

- **Urgent fixes now, suggestions into the plan.** In his words: if he reports something
  broken, fix it immediately; if he suggests an improvement, add it to the plan and
  implement it when you reach the related task. Do not abandon the current task to chase
  a suggestion.
- **Production quality, not a demo.** He said this at the outset and has held to it. No
  placeholder implementations, no "good enough for testing".
- **Explain, do not just deliver.** He is learning this stack. A change with reasoning
  attached teaches him something; a change without it makes the codebase less his.
- **He tests in the browser himself.** Give him a short, specific list of what to click
  and what to look for.
- **Run `npm run verify` before claiming anything works**, and for anything touching the
  database or a page, load it in the browser and read the server log too.

## Where the last session stopped

The final commit is `64ea98c`, "Attach reference photos to a lead". Immediately before
it, `6716f01` added the spreadsheet importer, and `559964f` fixed the `server-only` leak
that was crashing `/customers`.

Nothing is half-finished in the working tree: `git status` is clean, verify passes, the
build is clean. The next piece of work is **the n8n intake** as described above, unless
the owner says otherwise.

Two loose ends that are his to decide, not yours to assume: the five unpushed commits,
and whether brand assets or the intake comes first.
