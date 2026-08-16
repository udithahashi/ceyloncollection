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
| 5     | [docs/DEPLOYMENT.md](DEPLOYMENT.md)           | The production stack, deploys, backups, the restore drill |
| 6     | [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md) | When something breaks                                     |
| 7     | [docs/GLOSSARY.md](GLOSSARY.md)               | Any term you or the owner does not recognise              |
| 8     | [docs/ORIGINAL-PLAN.md](ORIGINAL-PLAN.md)     | Optional. The pre-Phase-0 plan this project started from  |

`CLAUDE.md` simply points at `AGENTS.md`, so both Claude Code and Cursor read the same
rules. There is no second source of truth to keep in step.

## Where this project started

The owner planned this project with Cursor before switching tools over a credit limit,
and asked that plan be kept rather than lost. It lives verbatim at
[docs/ORIGINAL-PLAN.md](ORIGINAL-PLAN.md), with a provenance note at the top listing the
known places actual implementation diverged from it (n8n's bearer-token fallback, no
TanStack Table/nuqs, the public website now being in scope). Read it for the _reasoning_
behind decisions already made - PostgreSQL over MySQL, one Next.js app instead of
Laravel + React, the phone-as-unique-key model - all of which still hold. For _current
state_, this file and the code are the source of truth, not that plan.

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

**State of `npm run verify` as of this revision:** typecheck, lint, and all 601 tests
pass. The one thing `verify` will flag that is not a project problem: `format:check`
fails on files under the untracked `.agents/` and `VibeSec-Skill/` directories (Claude
Code skill installs, not part of this codebase) — ignore those, they are not tracked by
git.

Migrations through `0006_cloudy_rhino` are applied.

## Where the project stands

Built, working, committed:

| Area                  | State                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Local dev environment | Docker PostgreSQL 17 + Redis 7, `npm run setup`, `npm run doctor`, wait-for-db, secret-scanning pre-commit hook                |
| Configuration         | Zod-validated `@/lib/env`, `server-only`-guarded. Pino logger with redaction. `@/lib/time` for the Qatar timezone              |
| Design system         | Theme tokens for `public`, `admin-dark`, `admin-light`; SSR theme switch with no flash; contrast asserted vs WCAG AA           |
| Auth                  | Better Auth, invite-only, TOTP two-factor, four roles, permission table in `@/lib/auth/roles`, activity log                    |
| Taxonomy              | Ten lists, 389 seeded values, full CRUD with reorder/retire/restore, one page serves all ten via a registry                    |
| Leads and customers   | Schema, list with filters, detail, edit, status changer, `customer_summary` view, E.164 phone identity                         |
| Spreadsheet import    | `/admin/leads/import`: dry-run report per row, duplicate detection, no invented taxonomy values, safe to re-upload             |
| Lead photos           | Upload, re-encode via sharp (EXIF stripped), thumbnails, `/lead-images/[id]/[variant]`, delete removes the file                |
| Analytics             | Boards, not one dashboard. Demand board built with Chart.js; money, stock and orders declared as planned                       |
| Demo data             | `npm run db:demo` invents ~140 leads; `npm run db:demo -- clear` removes them                                                  |
| n8n intake            | `POST /n8n/intake` (bearer token or HMAC), staging table `lead_intake`, review queue at `/admin/intake`. Setup: `LOCAL-DEV.md` |
| CI                    | `.github/workflows/ci.yml` Build step has the env vars `@/lib/env` needs at import time; was silently red before               |
| Deployment            | `Dockerfile`, `docker/compose.prod.yml`, GHCR publish in CI, nightly backup + restore drill. See `docs/DEPLOYMENT.md`          |
| Activity log page     | `/admin/activity`, `activityLog:read`-gated, filter by action, paginated                                                       |
| Dev-only design page  | `/admin/dev/design` - the old dashboard showcase, `notFound()` in production                                                   |
| Public website        | `/` - batik-led editorial homepage, GSAP + Lenis motion, mobile drawer nav, offers. See `docs/ASSETS.md`                       |

**The URL layout changed, and it is the first thing to know.** The back office now
lives under `/admin`, because the public site wanted the bare domain. `/admin`,
`/admin/leads`, `/admin/taxonomy` and so on; the sign-in flow keeps its own top-level
paths (`/login`, `/two-factor`, `/accept-invitation`, `/setup-two-factor`).

**There are two root layouts**, which is unusual enough to be worth stating plainly.
`src/app/(public)/layout.tsx` and `src/app/(back-office)/layout.tsx` each render their
own `<html>`. They exist because `robots` is set on a root layout and the two halves
need opposite answers - the shop window must be indexable, the back office must never
be. The public one also pins `data-theme="public"`, which is what swaps in the brand's
editorial typefaces and square corners. Navigating between the two is a full page load,
which is correct and rare.

**The proxy's session gate is inverted from what it used to be.** `src/proxy.ts` now
redirects only `PROTECTED_PREFIXES` (`/admin`) rather than everything not excused.
That is safe only because the gate was always a performance shortcut and never the
access check - the admin layout calls `requireUser`, and every page and action
authorises itself. `proxy.test.ts` covers both directions now. Do not "restore" the old
deny-everything behaviour without reading that file's comments; it would lock the
public site behind the staff door.

Not built yet:

- **Brand assets.** No real logo — the owner has hired a human designer for it, so this
  is no longer an AI-generation task; see §2. `src/app/icon.tsx` is a coded placeholder
  favicon, not a designed asset. No empty-state illustrations yet either.
- **Public site beyond the homepage.** `/` is built and is one long editorial scroll.
  There is no second page — no about, no journal, no browse. The nav is anchor links
  within that page, and there IS now a full-screen mobile drawer (`mobile-nav.tsx`).
- **The public site's visual design is not signed off.** The owner's verdict on the
  current homepage: it does not look professional. Structure, copy, imagery pipeline
  and motion plumbing are all in place and working; what is missing is the design
  itself — type scale, spacing rhythm, composition, colour weighting. Deliberately
  parked to come back to, not abandoned. Two things to fix while you are in there:
  the headline still says "The batik you cannot find here" over a photograph of a
  flower frock, and `public/brand/edit-batik-frock2.webp` is an unreferenced
  byte-identical duplicate that can be deleted.
- **Money, stock, orders.** Declared in `src/features/analytics/boards.ts` and shown as
  planned. No tables, no queries.

## The plan from here

In the order the owner and I agreed. He may reprioritise — ask if it is not obvious.

### 1. n8n intake — done, merged to `main`

Done: `POST /n8n/intake` (bearer token or HMAC signature, `crypto.timingSafeEqual`,
five-minute replay window, idempotent on `externalId`), the `lead_intake` staging table,
and the review queue at `/admin/intake` that promotes a staged row to a lead or dismisses it.
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
promote and dismiss were both driven through `/admin/intake` in the browser, producing leads
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

### 2. Brand assets — logo is now a human designer's job, not AI's

**Reversed since the previous revision of this file.** A brand-kit session generated
three Recraft SVG logo candidates (monogram, folded-cloth pictorial, measured-gap
abstract) and the owner rejected the whole direction: **he has hired a human designer
for the actual logo. Do not generate logo marks with AI for this project again** — ask
if this is ever unclear rather than assuming it has changed back.

What's in place instead: `src/app/icon.tsx` is a **placeholder favicon**, built with
code (`next/og`'s `ImageResponse`), not image generation — navy background, "CC" in gold,
using the same `brand` tokens as everything else. It exists so the browser tab isn't the
generic Next.js icon while the real logo is pending. Delete it the moment the designer
delivers a real mark; a static `icon.png` or `favicon.ico` in `src/app/` takes over
automatically, no code change needed elsewhere. `BrandMark`
(`src/components/layout/brand-mark.tsx`) is unaffected — it was already text, not an
AI-generated asset, and stays that way until the designer's mark exists to reference.

**Photographic imagery for the public site did go through Higgsfield**, and worked -
five images from `nano_banana_pro`, every prompt recorded in `docs/ASSETS.md`. So the
door is closed for the logo specifically, not for art direction generally.

**Not yet decided:** whether empty-state illustrations for the back office (a separate
category again — flat illustration rather than photography) go through Higgsfield or
wait for the same designer. Ask before generating those.

### 3. Deployment to the Contabo VPS — scaffolded, not yet run for real

Everything code/config can carry is done and verified locally: multi-stage `Dockerfile`
(a `runner` target for the app, a `migrator` target that reuses the builder stage's full
`node_modules` rather than hand-picking a partial one - see the file's own comment),
`docker/compose.prod.yml` (app, PostgreSQL, Redis, Caddy as the reverse proxy, a nightly
backup), the `publish` job in `.github/workflows/ci.yml` pushing both images to GHCR on
every green push to `main`, `scripts/backup-db.sh`, and the restore drill - all written
up in the new `docs/DEPLOYMENT.md`.

**Actually verified, not just written:** built both Dockerfile targets locally, confirmed
`sharp`'s Linux binary is present in the `runner` image, ran the container and got `200`
from `/login` and `/icon` with the healthcheck reporting `healthy`, confirmed it runs as
the non-root `nextjs` user, and ran the `migrator` image against the real dev database -
it connected and correctly reported "Nothing to apply; already up to date." Separately
ran `scripts/backup-db.sh` against the dev database, then verified the resulting `.dump`
with `pg_restore --list` (163 TOC entries) - the backup script has produced one real,
inspected-valid dump; the restore drill in `docs/DEPLOYMENT.md` is written but has not
yet been run end-to-end into a throwaway container.

**What's still the owner's to do, because it needs the real VPS:** provision the
Contabo box, point DNS at it, create a GHCR access token, copy
`docker/.env.production.example` to `.env.production` with real secrets, and walk
through `docs/DEPLOYMENT.md`'s "First deploy" section for real. Nobody has run the
restore drill against production data yet either - do that once the first real backup
exists.

Two specifics that already bit once and are now handled, documented here so nobody
"fixes" them back into a trap:

- **`sharp` is a native module.** The Dockerfile never copies a host `node_modules` in -
  every stage that installs dependencies runs `npm ci` inside the Linux build. On top of
  that, `next.config.ts` now sets `outputFileTracingIncludes` for `sharp` explicitly,
  because Next's own docs list sharp as the example of a native module the standalone
  tracer can miss even when the build otherwise looks fine.
- **`STORAGE_LOCAL_DIR` must be a mounted volume.** `docker/compose.prod.yml` mounts it
  as the named volume `uploads`, never a host bind path someone forgot to create. The
  Dockerfile creates and `chown`s that directory to the non-root `nextjs` user before
  the volume exists, because Docker seeds a fresh named volume's ownership from
  whatever the image already has there - skip that step and the volume comes up
  root-owned, which is exactly the failure `npm run doctor`'s writability check is
  there to catch.

One more, new in this pass: `tsx` and `dotenv` moved from `devDependencies` to
`dependencies` in `package.json`. The `migrator` image needs them at container-run
time to execute `scripts/migrate.mts` in production, not just during local `npm run
db:migrate` - `npm run typecheck`/`lint`/`test`/`build` don't care which list a package
is in, so this only shows up if someone "cleans up" the dependency list without reading
why first.

### 4. Money, stock and orders

The business areas after the leads work: purchases and landed cost (goods, freight,
customs, delivery), stock on hand, and orders from enquiry to delivery. Each brings its
own tables, its own `features/<area>/analytics.ts`, and its own board. Do not add these
charts to the demand board — that separation is the point of the boards structure.

### 5. Smaller pending items

- ~~Trim the dashboard.~~ **Done.** The "Design foundations" showcase moved to
  `/admin/dev/design` (`src/app/(back-office)/admin/dev/design/page.tsx`), gated on
  `isProductionDeployment` from `@/lib/env` rather than a permission - it is not
  sensitive, it simply is not the owner's day-to-day tool. `notFound()` in
  production, reachable in development. The dashboard itself lost the section, the
  now-unused imports, and the `theme`/`themeName` it only existed for.
- ~~Activity log page.~~ **Done.** `/admin/activity` (`src/app/(back-office)/admin/activity/page.tsx`),
  gated on `activityLog:read`, in the nav under Configuration. One filter (by
  action, plain `<form method="get">` with a submit button - `SelectField` is a
  Server Component on purpose, so no client-side auto-submit), the same
  URL-is-the-state pagination the leads list uses. `src/features/activity-log/`
  holds the query, the filter parsing, and a `Record<ActivityAction, string>`
  label map (`labels.ts`) - a lookup table rather than a string transform, so a
  new action added to the schema without a label is a type error. Verified with
  the real dev database: 83 real rows, actor names, "Lead 291"-style entity
  labels, the action filter narrowing correctly, pagination at 50/page.
- **Browser walkthroughs the owner has not done yet:** add a photo to a lead (a portrait
  phone photo, to confirm it is not sideways), import `public/lead-import-template.csv`,
  look at `/admin/analytics/demand` in both themes, and — new — open `/admin/intake`, review one of
  the two staged rows already sitting there, promote it, then dismiss the other. That
  last one is not optional polish: it is the one part of the n8n intake work nobody has
  actually clicked through yet.
- **Watch the public site's motion in a real browser.** The GSAP work could not be
  verified visually from here: the automated browser pane does not composite frames, so
  `document.hidden` is true, `requestAnimationFrame` never fires, and GSAP's ticker
  cannot advance — the hero sits at its `from` state of `opacity: 0` and looks broken
  when it is not. Everything else about the page was checked (markup, images, tap
  targets, no horizontal overflow at 375px), but whether the hero entrance and the
  scroll reveals actually feel right is the one thing that needs human eyes. Open `/`,
  scroll slowly, then turn on the OS "reduce motion" setting and reload — with it on,
  every section must be immediately visible and static, never blank.

## The public site cannot launch until these two are real

Both live in `src/features/site/content.ts`, and both are deliberate blanks rather
than guesses.

1. **The WhatsApp number.** `WHATSAPP_NUMBER` is `97450000000`. Every call to
   action on the page points at it.
2. **Every offer figure.** Free-delivery threshold, the regulars' discount, the
   seasonal offer and its deadline all render as `___`, from the exported
   `TODO_FIGURE` constant. Grep for `TODO_FIGURE` to find all of them. They are
   blank on purpose: a discount is a promise the business has to keep, and
   inventing one would be the same mistake as inventing "9,000+ pieces woven"
   would have been. Fill them in, or delete the offers section.

## Traps that have already caught someone

**A statically prerendered page silently breaks the CSP, and only in production.**
`src/proxy.ts` issues a per-request nonce and Next stamps it onto every script and
style tag. A prerendered page is built once, when there is no request and no nonce,
so it ships with none - while the proxy still sends a nonce + `strict-dynamic`
policy at runtime, and the browser refuses every script on the page. The public
homepage hit this: 28 script tags, zero nonces, all blocked, while the dynamic
`/login` had 20 tags and 20 nonces and was fine. It does not reproduce in `npm run
dev`. The fix is `await connection()` from `next/server` at the top of the page -
and note that **`export const dynamic = 'force-dynamic'` is not enough**; the route
still reported `x-nextjs-prerender: 1` and served a nonce-less shell. Any new page
under `(public)` needs the same line.

**`pkill` does not work here, so you can end up testing a stale server.** Git Bash's
`pkill -f "next start"` reports success and leaves the process running, which means
a rebuild appears to change nothing and you go looking for a bug in your code. Twice
in one session the "fix did not work" was actually a server from ten minutes ago.
Kill by port instead, from PowerShell:
`Get-NetTCPConnection -LocalPort 3001 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`.

**Lenis needs its stylesheet and its `anchors` option, or the page half-works.**
`lenis/dist/lenis.css` is imported by `smooth-scroll.tsx` and is load-bearing: its
first rule is `html.lenis { height: auto }`, which undoes the `h-full` this app puts
on `<html>` - without it Lenis measures a viewport-height document and the page will
not scroll. Separately, Lenis owns the scroll position, so a native anchor jump moves
the browser without telling it and the page snaps back or does nothing. `anchors:
true` fixes that, and it matters because every piece of navigation on the public site
is an anchor, including the mobile drawer.

**The automated browser here cannot verify animation.** Its pane does not composite
frames, so `document.hidden` is true, `requestAnimationFrame` never fires, and GSAP's
ticker cannot advance - elements sit at their `from` state looking broken when they
are not. The same applies to CSS transitions. Markup, layout, tap targets and
accessibility are all verifiable; how the motion _feels_ is not. Do not report
animation as verified from here, and do not "fix" a stuck opacity that is only stuck
because the pane is hidden.

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

The final commit is `72f4fff`, "Give the Build step the env vars it always needed."
`main` is even with `origin/main` and the tree is clean (aside from untracked Claude
Code skill-tooling directories that are not part of this codebase). `npm run verify`
passes in full: typecheck, lint, format, and all 594 tests.

Everything that was on `feature/n8n-lead-intake` is now merged into `main` — the branch
is gone, its work landed as ordinary commits: `679312d` (schema, endpoint, review queue,
the `persist.ts` refactor), `16722e2` (bearer-token support plus the two review-page
bugs found by browser testing), `b85d1fb` (the pre-existing `range.test.ts` clock bug,
fixed on its own rather than folded into the intake commits), and `72f4fff` (CI's Build
step was missing the env vars `@/lib/env` needs at import time — every push had been
red at Build since Phase 0, not just this branch; `/n8n/intake` just made the gap
visible for the first time on a PR).

The owner ran a real n8n workflow against the intake endpoint from his own Docker n8n,
and promote and dismiss were both driven through `/admin/intake`, producing leads 289-291.
The two bugs that walkthrough exposed are fixed and recorded under "Traps" — both were
invisible to the type checker and to every test, which is the argument for the browser
step.

One design decision was reversed part-way and is worth not re-reversing: **the endpoint
originally demanded an HMAC signature and now also accepts a plain bearer token.**
Requiring the signature meant n8n needed a Code node, and n8n's sandbox refuses
`require('crypto')` unless the container is started with
`NODE_FUNCTION_ALLOW_BUILTIN=crypto` — which on a managed n8n may not be possible, and
which makes "add an integration" mean "rebuild the container". That is not a workable
production story for a solo operator with one VPS. The signature path is still there,
still tested, and still wins when both credentials are sent. `CONCEPTS.md` states plainly
what the token gives up and why it is acceptable for an internal-network-only endpoint.

What's left is the owner's to decide, not yours to assume: whether brand assets (§2) or
deployment (§3) comes next now that the intake work has landed, and the browser
walkthroughs under "Smaller pending items" that nobody has clicked through yet.
