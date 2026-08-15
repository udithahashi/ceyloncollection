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

`git log` is the honest history — every commit message explains the reasoning behind
that change, so `git log -p` on a feature is often faster than reading the files cold.

**Two things to know before you trust `npm run verify`:**

1. **The working tree is not clean, and that is deliberate.** The n8n intake work sits
   on the branch `feature/n8n-lead-intake` (commit `679312d`, plus uncommitted follow-up
   fixes from browser testing), unpushed, waiting on the owner. Do not discard it; read
   `git status` before assuming any of it is scratch work.
2. **Three tests in `src/features/analytics/range.test.ts` fail, and they are not
   yours.** They fail identically on `e7aa54e`, before the intake work started.
   `parseRange` takes an injectable `now` but line 93 reads the real clock via
   `todayInBusinessTime()` while the range start uses the injected date, so the two
   disagree by a day once the real date passes the date pinned in the test
   (2026-08-14). One-line fix: `const today = businessDate(now);`. Harmless in
   production, where `now` defaults to the real clock and both agree. Everything else
   passes: typecheck, lint, format, and 580 other tests.

Migrations through `0006_cloudy_rhino` are applied.

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

Built and browser-verified, **on `feature/n8n-lead-intake`, unpushed**:

| Area       | State                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| n8n intake | `POST /n8n/intake` (bearer token or HMAC), staging table `lead_intake`, review queue at `/intake`. Setup: `LOCAL-DEV.md` |

Not built yet:

- **The public website.** Nothing exists under a `(public)` route group. The brand design
  system is ready for it; the reference design is `reference/public-website.html`.
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

### 1. n8n intake — built and working, awaiting review and a push

Done: `POST /n8n/intake` (bearer token or HMAC signature, `crypto.timingSafeEqual`,
five-minute replay window, idempotent on `externalId`), the `lead_intake` staging table,
and the review queue at `/intake` that promotes a staged row to a lead or dismisses it.
The design is in docs/CONCEPTS.md under "Automated intake from n8n"; the step-by-step
setup, including the production story, is in docs/LOCAL-DEV.md under "The n8n intake";
the traps are in docs/TROUBLESHOOTING.md. `docs/n8n-intake-workflow.json` is a working
two-node workflow to import, and `npm run intake:simulate -- "message"` posts a signed
test message with no n8n involved at all. `resolveCustomer` was extracted to
`src/features/leads/persist.ts` as planned, and is now shared by the manual form, the CSV
importer and this.

The owner has a working workflow running against it from his local Docker n8n.

**Not yet done, on purpose:** n8n is not asked to guess taxonomy (fabric, size,
category…) from the message text — nobody has built that extraction, and CONCEPTS.md
explains why the contract stays thin until someone does. The obvious next step there is
an LLM node inside the n8n workflow filling in `platform` and the garment fields, which
would narrow the review to confirming rather than typing.

**Verified end to end**, in the browser and over HTTP: bearer token, wrong token, no
credentials, HMAC signature, stale timestamp, malformed body and an idempotent retry all
behave correctly; a real n8n workflow on the owner's Docker n8n reached the endpoint; and
promote and dismiss were both driven through `/intake` in the browser, producing leads
289-291 with `source = 'automation'` in the local dev database.

**Two bugs were found by doing that, and both are fixed** - they are worth knowing about
because both were invisible to the type checker and to every test:

- The review page rendered "Dismissed. Nothing was recorded." the instant it opened.
  `idleActionState` is `{ ok: true, data: undefined }`, so a component asking only
  `state.ok` gets `true` before anything has been submitted. Test `data !== undefined`,
  which is what `LeadForm` already did and what the intake form now does too.
- Promoting a message 404'd, hiding the new lead's reference. A Server Action re-renders
  the route it was called from, and by then the staged row is no longer `pending`, so the
  page's own `notFound()` fired on success. The page now renders an outcome panel for an
  already-reviewed row and reserves 404 for a row that does not exist.

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
- **Browser walkthroughs the owner has not done yet:** add a photo to a lead (a portrait
  phone photo, to confirm it is not sideways), import `public/lead-import-template.csv`,
  look at `/analytics/demand` in both themes, and — new — open `/intake`, review one of
  the two staged rows already sitting there, promote it, then dismiss the other. That
  last one is not optional polish: it is the one part of the n8n intake work nobody has
  actually clicked through yet.

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

**`src/proxy.ts` redirects anything with no session cookie to `/login`, by default
including a route that was never supposed to need one.** Building `/n8n/intake` and
testing it with signed `curl`/`fetch` requests got a `200` back containing the login
page's HTML — the signature check never even ran, because the proxy caught the
cookie-less request first and redirected before the route handler saw it. `PUBLIC_PATHS`
was the wrong fix: `proxy.test.ts` asserts every entry there is a real page under
`(auth)`, on purpose, so a webhook route does not belong in that list. The actual fix is
`SELF_AUTHENTICATING_PREFIXES` in `src/proxy.ts` — paths that prove themselves some other
way and must bypass the session gate entirely, currently just `/n8n/`. **Any new
non-session HTTP endpoint needs an entry there, or it will silently never receive a
request in the first place**, and the failure looks exactly like a working endpoint
rejecting everything, not like a routing problem.

**`idleActionState` is `{ ok: true, data: undefined }`, so `state.ok` is true before a
form has ever been submitted.** A panel rendered on `state.ok` alone appears the instant
the page opens - the intake review page greeted every visitor with "Dismissed. Nothing
was recorded." in place of the form. Test `state.data !== undefined`, and give the action
something to return if its success would otherwise carry nothing.

**A Server Action re-renders the route it was called from, so a page can 404 on its own
success.** `/intake/[id]` called `notFound()` for any row that was not `pending` - which,
immediately after promoting one, is the row you just promoted. The save worked and the
screen said "page not found". A page whose action changes the thing the page is keyed on
has to render that outcome rather than treat it as absence.

**A signature can be wrong because the body was re-encoded, not because the secret is.**
n8n's Raw body mode with content type `application/json` JSON-encodes the string it is
given, so a body that is already JSON arrives double-quoted and the HMAC covers different
bytes. Hours went into suspecting the secret. When a signature check fails, log what
actually arrived - `rawBody.length` alone would have found it immediately.

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

The final commit is `e7aa54e`, "Write the handover, so the next session starts
informed" — this file's previous revision. `main` was even with `origin/main` at that
point and stayed that way; nothing has been pushed since.

The session after that one built the n8n intake feature described under "The plan from
here" § 1: the schema, the endpoint, the review queue, and the `persist.ts` refactor the
previous handover asked for. It lives on **`feature/n8n-lead-intake`** — commit
`679312d` plus uncommitted fixes found while testing in the browser. Nothing is pushed
and no PR is open.

The owner ran a real n8n workflow against it from his own Docker n8n, and promote and
dismiss were both driven through `/intake`, producing leads 289-291. The two bugs that
walkthrough exposed are fixed and recorded under "Traps" — both were invisible to the
type checker and to every test, which is the argument for the browser step.

One design decision was reversed part-way and is worth not re-reversing: **the endpoint
originally demanded an HMAC signature and now also accepts a plain bearer token.**
Requiring the signature meant n8n needed a Code node, and n8n's sandbox refuses
`require('crypto')` unless the container is started with
`NODE_FUNCTION_ALLOW_BUILTIN=crypto` — which on a managed n8n may not be possible, and
which makes "add an integration" mean "rebuild the container". That is not a workable
production story for a solo operator with one VPS. The signature path is still there,
still tested, and still wins when both credentials are sent. `CONCEPTS.md` states plainly
what the token gives up and why it is acceptable for an internal-network-only endpoint.

Three things are the owner's to decide, not yours to assume: whether this branch is
pushed and merged as one change or split up; whether the pre-existing `range.test.ts`
failure is fixed on this branch or its own; and whether brand assets or deployment comes
next once it lands.
