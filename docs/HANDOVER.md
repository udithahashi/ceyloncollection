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

| Order | Document                                        | What you get                                               |
| ----- | ----------------------------------------------- | ---------------------------------------------------------- |
| 1     | `AGENTS.md`                                     | The non-negotiable rules. Nine of them. Do not break them  |
| 2     | This file                                       | State, plan, traps, and where the last session stopped     |
| 3     | [docs/CONCEPTS.md](CONCEPTS.md)                 | The architecture and the reasoning behind every choice     |
| 4     | [docs/LOCAL-DEV.md](LOCAL-DEV.md)               | Day-to-day commands                                        |
| 5     | [docs/DEPLOYMENT.md](DEPLOYMENT.md)             | The production stack, deploys, backups, the restore drill  |
| 5b    | [docs/DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md) | Only if the app is hosted on Hostinger rather than the VPS |
| 6     | [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md)   | When something breaks                                      |
| 7     | [docs/GLOSSARY.md](GLOSSARY.md)                 | Any term you or the owner does not recognise               |
| 8     | [docs/ORIGINAL-PLAN.md](ORIGINAL-PLAN.md)       | Optional. The pre-Phase-0 plan this project started from   |
| 9     | [docs/BUSINESS.md](BUSINESS.md)                 | The business, not the code: what it sells, to whom, how    |

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

| Area                  | State                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local dev environment | Docker PostgreSQL 17 + Redis 7, `npm run setup`, `npm run doctor`, wait-for-db, secret-scanning pre-commit hook                                            |
| Configuration         | Zod-validated `@/lib/env`, `server-only`-guarded. Pino logger with redaction. `@/lib/time` for the Qatar timezone                                          |
| Design system         | Theme tokens for `public`, `admin-dark`, `admin-light`; SSR theme switch with no flash; contrast asserted vs WCAG AA                                       |
| Auth                  | Better Auth, invite-only, TOTP two-factor, four roles, permission table in `@/lib/auth/roles`, activity log                                                |
| Taxonomy              | Ten lists, 389 seeded values, full CRUD with reorder/retire/restore, one page serves all ten via a registry                                                |
| Leads and customers   | Schema, list with filters, detail, edit, status changer, `customer_summary` view, E.164 phone identity                                                     |
| Spreadsheet import    | `/admin/leads/import`: dry-run report per row, duplicate detection, no invented taxonomy values, safe to re-upload                                         |
| Lead photos           | Upload, re-encode via sharp (EXIF stripped), thumbnails, `/lead-images/[id]/[variant]`, delete removes the file                                            |
| Analytics             | Boards, not one dashboard. Demand board built with Chart.js; money, stock and orders declared as planned                                                   |
| Demo data             | `npm run db:demo` invents ~140 leads; `npm run db:demo -- clear` removes them                                                                              |
| n8n intake            | `POST /n8n/intake` (bearer token or HMAC), staging table `lead_intake`, review queue at `/admin/intake`. Setup: `LOCAL-DEV.md`                             |
| CI                    | `.github/workflows/ci.yml` Build step has the env vars `@/lib/env` needs at import time; was silently red before                                           |
| Deployment            | `Dockerfile`, `docker/compose.prod.yml`, GHCR publish in CI, nightly backup + restore drill. See `docs/DEPLOYMENT.md`                                      |
| Activity log page     | `/admin/activity`, `activityLog:read`-gated, filter by action, paginated                                                                                   |
| Dev-only design page  | `/admin/dev/design` - the old dashboard showcase, `notFound()` in production                                                                               |
| Public website        | Editorial fashion house: `/`, `/collections`, `/pieces`, `/journal`, `/about`. Data-driven catalogue, WhatsApp enquire, GSAP + Lenis. See `docs/ASSETS.md` |

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
- **Public site photography is mid-rebuild.** The information architecture and
  pages exist (`/`, `/collections`, `/collections/[slug]`, `/pieces/[slug]`,
  `/journal`, `/about`). Typography is now Fraunces / Manrope / Outfit, colours
  unchanged. Campaign photography still uses the previous Higgsfield set in
  `public/brand/` — a new shoot (Maya, Skyler, Viana, plus a male character,
  officewear and knits) was started via the Higgsfield CLI and is not finished.
  `public/brand/edit-batik-frock2.webp` is still an unreferenced duplicate.
- **The public site's visual design is not signed off.** The previous homepage
  was cleared and rebuilt from scratch around අපේ කම. Needs the owner's eyes
  in a real browser, including motion (the automated pane cannot verify GSAP).
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

- ~~Public site was double-compressing photos.~~ **Done.** Every `<Image>` in
  `public/brand/` on the public site now sets `quality={95}`, not just the homepage
  hero. Next's default is `quality={75}` when the prop is omitted, and every one of
  these photos is already a hand-compressed WebP, so the default was a second lossy
  pass on top of a deliberate first one - the same problem the hero image's
  `quality={95}` was already fixing, just not applied everywhere. Confirmed via the
  `/_next/image` request in the browser network tab: `q=95`, not `q=75`.
  **Not done, and worth doing properly rather than hardcoding a second number:** an
  admin setting to control this per-deployment - a quality/percentage the owner can
  raise or lower without a code change, plus perhaps a toggle for whether resizing
  runs at all. Next.js requires the allowed values to be declared statically in
  `next.config.ts`'s `images.qualities` at build time (`next.config.ts` currently
  lists `[75, 90, 95, 100]`); a runtime setting could not add a value outside that
  list without a rebuild, so the honest version of this feature is a dropdown
  constrained to values already declared there, stored in whatever settings table
  the back office ends up using, and read where these `<Image>` components render.
  Nobody has designed that table yet - this is a note for when someone does.
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

## The footer's policy pages, and what is still blank in them

`/policies/[slug]` serves five pages from `src/features/site/policies.ts`: how to order,
delivery, returns, privacy and terms. They exist because the footer links to them, and a
footer that 404s is worse than a footer with no policy links at all — so links and pages
ship together. Add a link to `site.footer.columns` only alongside the page it opens.

**Nothing in them invents a commitment.** A return window, a delivery charge, a retention
period and a registered company name are promises the business has to keep, so they are
NOT written as plausible defaults. Each policy carries a `pending` array naming what the
owner still has to decide, and the page renders that as one visible "Still being settled"
notice with a WhatsApp link. Empty the array and the notice disappears by itself.

This is deliberately NOT the `TODO_FIGURE` treatment used for the offer figures. `___`
works beside a label and fails inside prose: "we accept returns within ___ days" still
reads as a returns policy, and the opening half of that sentence is an admission on its
own. Naming the open questions in one block says exactly what is and is not decided.

What IS written is true of the system as built and is checkable: the public site sets no
cookies and loads no third-party trackers (verified — grep for `gtag|fbq|plausible|posthog`
under `(public)`), enquiries arrive over WhatsApp, the back office files them by phone
number. The privacy policy also states the deletion behaviour accurately rather than
conveniently: **photographs are deleted outright, written enquiry records are soft-deleted**
— so it says the record is "retired" and that a dated note is kept, because promising
deletion where the code soft-deletes would be a lie a customer could hold us to.

**Terms still to settle**, all in `policies.ts`: return window, condition and carriage;
delivery areas, times and cost; how long a retired enquiry record is kept; the registered
business name; and the country whose law the terms sit under.

## The public site cannot launch until these three are real

All three live in `src/features/site/content.ts`, and all three are deliberate
blanks rather than guesses.

1. **The WhatsApp number.** `WHATSAPP_NUMBER` is `97450000000`. Every call to
   action on the page points at it.
2. **Every offer figure.** Free-delivery threshold, the regulars' discount, the
   seasonal offer and its deadline all render as `___`, from the exported
   `TODO_FIGURE` constant. Grep for `TODO_FIGURE` to find all of them. They are
   blank on purpose: a discount is a promise the business has to keep, and
   inventing one would be the same mistake as inventing "9,000+ pieces woven"
   would have been. Fill them in, or delete the offers section.
3. **How long the house has been bringing pieces over.** The homepage's house
   panel (`site.house.stats.years`) shows the same `___`. The other two figures
   beside it are not blanks and never will be: they are `collections.length` and
   `pieces.length`, counted from `catalog.ts` at render time so they cannot drift
   from the catalogue. This one has no source in the code because it is a fact
   about the business. Fill it in, or drop that third item from `houseFigures` in
   `src/app/(public)/page.tsx` — a two-figure row is honest, an invented year
   count is not.

## Social channels, and the admin page they are waiting for

`src/features/site/social.ts` holds Instagram, Facebook and WhatsApp as **data** -
`{ platform, label, href }` - and `SocialLinks` renders whatever is in that array. They
appear in the header row on desktop, in the mobile drawer, and in the footer.

**The marks are the official Simple Icons outlines, pasted in, and that is deliberate.**
The first attempt built them from rectangles, circles and freehand strokes; they were
unrecognisable, because a brand mark is a specific shape people match against memory and
"close enough" reads as broken. `lucide-react` - already a dependency - is not an option
here: it dropped brand icons. Take any fourth channel's path from the same source rather
than drawing it, keep the 24x24 viewBox the paths are authored on, and keep them filled
rather than stroked.

**They were in the navy announcement strip first, and that was wrong.** The reasoning -
social links carry a "leave this site" signal, so keep them below the hero's two calls to
action - still holds, and the header row still separates them from `Enquire` with a
hairline rule for that reason. But 18px of blush on navy was effectively invisible.
Subordinate is not the same as unfindable.

**The next step, and the reason the data is shaped this way: move these into a back
office settings page** so the owner can edit links, names and ordering, and add or
retire a channel, without a deploy. The component contract is already the row shape a
table would return - `platform`, `label`, `href`, plus an `order` column - so the work
is the table, the CRUD and swapping the array for a query. `platform` is a closed union
feeding a `Record<SocialPlatform, ...>` icon map on purpose: a channel added without a
mark drawn for it is a type error rather than a hole in the page. That is the one part
a settings page cannot make fully dynamic - a brand new platform still needs its icon
committed - so plan the UI as "choose a platform, set the link", not a free text field.

**The three hrefs are placeholders** pointing at the platforms' own home pages, in the
same state as `WHATSAPP_NUMBER`. WhatsApp's is built from that constant rather than
written out, so filling the number in fixes the icon too. Real profiles are needed
before launch or these are three links to nowhere.

**Why they are not in the hero.** Social icons carry a strong "leave this site" signal
and compete directly with a conversion action when placed beside one. The hero exists to
drive `View collections` and `Start a conversation`; three exits next to those buttons
would bid against the two things the page is for. Subordinate placement is the decision,
not an oversight - do not "improve" this by promoting them into the hero copy column.

## The page chrome is 8.3125rem, and it has already drifted once

`site-shell.tsx` states the header's exact height and the homepage hero subtracts it
twice - `min-h-[calc(100dvh-8.3125rem)]` on the hero section and on its image column -
so the two together fill exactly one screen.

It was 7.6875rem (123px) when the announcement strip was 30px. Sizing that strip's type
up for legibility made it 40px, and the hero went on subtracting ten pixels that no
longer existed. **Nothing looked broken; the fold was just quietly wrong**, which is why
it survived several passes. It is now 133px and measured.

If you touch the strip's type, its padding, or put anything in it, measure
`document.querySelector('header').getBoundingClientRect().height` in a real browser and
move the number in `site-shell.tsx` and both `calc()` values together. The social icons
briefly lived in that strip and had to be positioned absolutely to avoid growing it a
second time - they are in the header row now, where a 44px target costs nothing because
the row is already 93px tall.

## The arrivals rail: why it is not a carousel

`ScrollRail` (`src/features/site/components/scroll-rail.tsx`) carries the New arrivals
row: native horizontal scroll, CSS snap, hidden scrollbar, prev/next buttons on the
heading row. Three alternatives were considered and rejected on evidence, and the
component's own comment records the detail - **read it before replacing this with a
carousel library.**

- **A pinned GSAP horizontal section** is scroll-jacking. It hangs the viewport for
  anyone tabbing through, and Lenis plus ScrollTrigger is a documented source of tweens
  that never finish after an anchor jump - and every link on this site is an anchor.
  GSAP's own position is that ScrollTrigger was built deliberately not to jack scroll.
- **Auto-advancing** contradicts the research: roughly 1% of people interact with a
  carousel at all, most of those only ever seeing the first slide, and the movement
  costs comprehension. It also pulls in WCAG 2.2.2 (Pause, Stop, Hide).
- **Hiding the scrollbar alone** removes an affordance without replacing it. The buttons
  and the deliberate sliver of the next tile at the right edge are that replacement;
  they are not decoration, so do not "tidy" either away.

Two things that look optional and are not: the `<ul>` carries `tabIndex={0}` and a
label because a hidden scrollbar strips keyboard access from a scroll container (axe
calls this `scrollable-region-focusable`), and the buttons scroll by a **measured**
tile-plus-gap rather than a hardcoded width, so the step stays correct across
breakpoints. The rail scrolls without JavaScript; the buttons are an enhancement on top.

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

**A `fromTo` writes its start values the moment you CREATE it, not when the playhead
reaches it.** GSAP's `immediateRender` defaults to true, which is right for a lone tween
and wrong for every sequenced one. Building the hero's rotation timeline stamped
`opacity: 0` onto every target up front - including the resting word and the resting
photograph, because the last step of the loop cycles back to index 0 - so the hero
rendered with no picture and its headline parked below its own mask, and recovered only
seconds later when the first tween happened to reveal it. Nothing threw. Any `fromTo`
added to a paused or sequenced timeline needs `immediateRender: false`.

**A mask's padding makes its two exits asymmetrical.** `SplitReveal` pads each line mask
by `0.18em` for Fraunces' italic swash descenders, against `0.92` leading. A word
therefore sits flush with the mask's top and has 0.18em of mask left under it: clearing
upward costs 100% of the word's height, clearing downward costs (0.92 + 0.18) / 0.92, or
119.6%. The symmetrical ±110 that looks obviously correct leaves an 8px band of the
incoming word visible at the bottom of the mask before it moves. Both terms are `em`, so
the ratio holds at every breakpoint - see `ENTER_FROM` / `EXIT_TO` in `hero-rotation.tsx`.

**GSAP deletes Tailwind's `translate` when it animates an element, and nothing warns
you.** Tailwind v4 compiles `-translate-x-1/2` to the standalone `translate:` CSS
property, not to `transform:`. GSAP writes `translate: none; rotate: none; scale: none`
onto anything it tweens, so that it owns the matrix outright - which silently throws
away any Tailwind centring on the same element the moment the first frame runs. It
looks correct in the markup, correct in DevTools before the tween, and wrong only
after the animation fires. `ClosingRule` hit this: the mark's left corner landed on
the join instead of its middle. The fix is structural, not a class order - put the
positioning on an outer element and give GSAP an inner one. Anywhere a `Reveal` or
`SplitReveal` className grows a `translate-*` utility, the same thing will happen.

**A dead HMR socket leaves Tailwind's CSS stale, and only NEW class names notice.**
If `ws://localhost:3000/_next/hmr` fails in the console, the dev server keeps serving
the stylesheet it generated when it started. Existing utilities all still work, so the
page looks fine - but any arbitrary value you have just written for the first time
(`text-[clamp(...)]`, `max-w-[36rem]`, `right-[calc(...)]`) is simply absent from the
sheet and the element silently falls back to its inherited value. It reads exactly
like "Tailwind cannot parse this", and it is not; a reload does not fix it because the
server, not the browser, is holding the old CSS. Restart the dev server. Check for the
socket error before you go rewriting a class that was correct all along.

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

A corollary that cost time on its own: **in that pane, "playing but frozen" and
"waiting for a scroll that never came" are indistinguishable.** Both leave the element
at its `from` values. A hero line parked at `translateY(110%)` reads identically
whether its tween started or its ScrollTrigger never fired, so a reveal bug cannot be
confirmed or cleared by looking at computed transforms here. What _is_ verifiable is
the decision the code makes before the tween exists - measure the element with
`getBoundingClientRect()` and check it against the trigger line yourself. That is how
the two reveal bugs below were actually found.

**The reveal components start their content hidden in the HTML, which changes what a
missed trigger costs.** `Reveal` ships `opacity-0 translate-y-7` and `SplitReveal`
ships `translate-y-[110%]` on every line, both matching the tween's `from` values, so
that server-rendered content does not flash visible before hydration and then animate
in. The trade is that a trigger which never fires no longer leaves un-animated text -
it leaves a permanent blank, and for `SplitReveal` an empty space where a headline
should be, because the mask clips the parked line out of its own box. Two consequences
worth keeping in mind: the tweens must stay `gsap.fromTo()` (a `.from()` infers its end
state from the current computed style, which is now the hidden one, so it would animate
hidden-to-hidden), and `clearProps` must stay off the tween (it would hand control back
to the static hidden class after the animation finished). Both traps are documented at
length in the files themselves.

**`start: 'top 85%'` left visible text invisible, and it was not only the hero.** Any
element sitting between 85% of the viewport and the fold is plainly on screen and was
still waiting for a scroll event to reveal it - and with the static hidden classes
above, waiting meant blank. The hero hit it hardest because its copy column can run
taller than its own `min-h-[calc(100dvh-7.6875rem)]` (measured at 934px against a 777px
floor on a 1440x900 window - a min-height is a floor, not a cap), which pushed the
primary call to action past the trigger line entirely. Both `Reveal` and `SplitReveal`
now measure the element on mount and skip ScrollTrigger for anything already on screen;
`onLoad` remains as an explicit override the hero uses. Below-the-fold content is
untouched and still waits for the scroll. **If you add a reveal and its content is
blank on load, check where its top sits relative to the viewport before suspecting
GSAP.**

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

The public homepage was cleared, then rebuilt as an editorial fashion house
around අපේ කම. Routes now exist at `/`, `/collections`, `/collections/[slug]`,
`/pieces/[slug]`, `/journal`, `/journal/[slug]`, and `/about`. Catalogue,
campaigns and journal copy live in `src/features/site/` as data, not markup.

Public typography changed: Fraunces / Manrope / Outfit (Marcellus remains on
`BrandMark` only; the logo is still a coded placeholder). Brand colours did not
change. 605 tests pass. Higgsfield MCP auth was expired; the CLI is signed in
(ultimate plan) and a character-anchor generation is in flight via
`scripts/generate-campaign.mjs`. Until those land, pages reuse the previous
`public/brand/` photographs.

The owner still needs to look at `/` in a real browser (motion cannot be
verified from the automated pane), fill `WHATSAPP_NUMBER` and `TODO_FIGURE`,
and decide whether the new campaign photography should replace the current
images before anyone calls this signed off.

Since then, on the owner's direction: the hero's accent word is brand rose
rather than `ink-accent` (legitimate only because that headline is never
smaller than `3.2rem` — the comment above it explains why the token still
carries its decorative-only rule), the announcement strip reads "Chosen in
Sri Lanka · Brought to you with love" in tracked uppercase Outfit at
`0.2em`, and a new **house panel** sits between the selected pieces and the
journal: navy ground, a batik detail photograph with an inset hairline
frame, and three figures. Its shape came from a reference design whose
version was a craft story — "Woven by hand", 120+ artisans, 9,000+ pieces
woven. This house imports rather than manufactures, so the copy says
_chosen_, and the figures are counted from `catalog.ts` rather than typed
in. Read the comment on `site.house` before editing that copy.

**The hero headline was overflowing its column on every normal screen, and had been.**
`that remember` needs about 6.49px of line per px of type. Five columns of the twelve-
column hero grid, minus `lg:px-10`, gave it 514px at 1440 when it wanted 660 - so the h1
wrapped into five visual lines instead of three at every width from `lg` up to about
1776px, and only looked correct on a very wide monitor, which is why it survived review.
The masks hid it rather than exposing it: each clips per AUTHORED line, so a wrapped line
reveals two rows of type as one unit and the break reads as a styling choice. The text
column is now six of twelve and the vw term is `6.2`, measured at **1024**, which is the
binding case - not at whatever monitor you are reading this on. Re-measure there if the
headline copy or that column's padding changes.

**The hero headline's last word rotates, and it comes to rest.** `remember` -> `know` ->
`find`, each paired to a photograph that crossfades with it, then the hero settles back
on `remember` and stops. Holds decelerate (3.4s, 4.1s, 4.8s) so the stop reads as
settling rather than as breakage, and the timeline pauses off screen, pauses on a hidden
tab, and re-arms if someone leaves the hero entirely and comes back. Looping forever with
a growing delay was considered and rejected: the largest type on the page would never be
still, the next change could never be anticipated, and indefinite auto-motion alongside
other content is what WCAG 2.2.2 wants a pause control for.

**The rotating slot is much narrower than it looks - read `site.hero.rotation` before
adding a word.** It only accepts verbs where THE CLOTHES ACT ON YOU, in the plain
register the rest of the copy uses. `trust` reverses the relationship, and the manifesto
already says "The clothes you trust." `love` is exactly the sentimentality the note above
`site.manifesto` bans. The word must also stay LINE-FINAL in `titleLines`: the slot is
sized by the longest word and a shorter one simply leaves rag, so a swap never reflows -
move it mid-line and every swap reflows the headline.

**The hero's three slides, and which files they are.** `hero-1` (ivory, gold, occasion) is
the resting slide; `hero-2` is menswear - a black formal shirt, in an office - and
`hero-4` is womenswear. `hero-2` was supplied as `hero-3.webp` and renamed to match its
slide number. The watercolour-gown shot that used to be `hero-2.webp` was NOT deleted for
that rename: it is preserved as `hero-gown.webp`, out of the rotation, because nothing
under `public/brand/` is tracked by git and the rename would have destroyed it with no way
back. `hero-4` is a placeholder the owner intends to replace - it is a different model in
a different photographic language - and `hero-3d.webp` is the old AI sample, also awaiting
replacement. Both are known and neither is urgent.

**Each hero slide carries its own featured-piece card, and that is not decoration.** The
card is laid over the photograph in the corner, so a reader takes it as a caption on
whatever is behind it. Rotating the picture without rotating the card left "The Nimali
frock - a small blush print on cream cotton" sitting over a man in a black shirt. Each
`site.hero.rotation` entry now names a piece that exists in `catalog.ts` and whose link
resolves, worded from that entry's own subtitle and description so the hero cannot drift
from the catalogue. Add a slide, add its piece.

**The parked cards are hidden by `visibility`, and must NOT be given `aria-hidden` or
`tabIndex`.** Both were tried. They are static server-rendered attributes on elements
whose visibility moves on a timer, so one swap later the card the visitor can see is the
one marked hidden and untabbable, while the invisible one is the only thing still
advertising `tabIndex=0`. `visibility: hidden` already removes an element from the tab
order and from the accessibility tree, and GSAP's `autoAlpha` keeps it in step on every
frame - which is why the cards animate on `autoAlpha` and the photographs on plain
`opacity`.

**"The idea" is now built out of its own argument, and that is the point of it.**
`content.ts` states the section's claim outright: distance is the only thing between
the reader and clothing they already trust, and this house closes it. Three versions
said that in words and laid it out as a headline with a paragraph beside it - a
section about closing a gap that did not close anything. It now draws it. The
statement is split in two, the trust at the top left and where the reader is at the
bottom right, and between them a bronze rule reaches in from either edge of the
window with a gap in the middle. On scroll the gap closes and the house's mark is on
the join. The three beats follow as full-window ruled bands, so the whole section
reads as a manifest rather than as a page with boxes on it.

**Do not close the two halves of the statement back up into one block.** The space
between them is the distance; the section has nothing left to say without it. The
reasoning, including why the resting state is the closed rule and why the join is at
58% rather than 50%, lives on `src/features/site/components/closing-rule.tsx`. That
component is deliberately not reusable - a second one on the page costs the first its
meaning.

Several numbers in that section are measured, not chosen, and each carries a comment
saying so: the statement's `7vw`, the unequal `lg:mt-26 lg:mb-30` around the rule
(equal margins put the rule 15px low, because line boxes are not ink), and the body's
`32rem` / `lg:36rem` cap that holds every row to ~70 characters. **Do not "simplify"
that cap to `ch`.** Manrope's zero is far wider than its lowercase, so `68ch` measured
out at 87 characters - the unit looks like a character count and is not one.
