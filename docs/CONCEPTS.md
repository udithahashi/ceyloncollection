# Concepts

Written for someone comfortable with PHP, Laravel and MySQL who has not used this
stack before. It explains what each piece is, what it replaces from the world you
already know, and why it was chosen. Nothing here is required reading to get the
app running - that is `LOCAL-DEV.md`.

## The short version

You already know how to build this kind of application. What is unfamiliar is the
vocabulary, not the ideas. The table below is the whole translation:

| What you know              | What this project uses             | Notes                                                         |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| PHP                        | TypeScript                         | Same job, different syntax. Types are checked before it runs. |
| Laravel                    | Next.js                            | Routing, request handling, and rendering in one framework     |
| Blade templates            | React components                   | Templates that are functions instead of files                 |
| Routes in `routes/web.php` | Folders under `src/app/`           | The folder path _is_ the URL                                  |
| Controllers                | Server Components + Server Actions | Reads are components; writes are actions                      |
| Eloquent                   | Drizzle ORM                        | Queries in TypeScript, checked against your real schema       |
| Migrations                 | Drizzle migrations                 | Same concept, generated from your schema file                 |
| `config/*.php` and `.env`  | `src/lib/env` and `.env.local`     | Difference: invalid config stops the app at startup           |
| MySQL                      | PostgreSQL                         | Stricter, better at analytics                                 |
| Composer / `vendor/`       | npm / `node_modules/`              | Identical idea                                                |
| Artisan commands           | `npm run <script>`                 | See the table in the README                                   |
| Laragon                    | Docker                             | Runs the database and cache without installing them           |

The genuinely new things to learn are TypeScript and React. Everything else is a
renamed version of something you have already done.

## Why not Laravel, then?

It was the first thing considered, and for a normal CRUD app it would have won.
Three things pushed the decision the other way.

**One language, one deployment.** A Laravel API plus a Next.js frontend means two
applications, two deploy pipelines, and a network hop between them that has to be
secured and authenticated. A single Next.js app has no gap between frontend and
backend to secure, because there is no gap.

**The analytics screens are custom.** The value of this system is in slicing lead
data by category, fabric, size, city and time. That is bespoke UI - charts,
filterable tables, top-N breakdowns - not the CRUD forms an admin panel generator
gives you for free. The generator's advantage largely disappears here.

**No public API surface.** In the Laravel-plus-frontend shape, every data
operation becomes an HTTP endpoint the browser can call, and each one must be
independently authenticated, authorised, rate limited and validated. In this
shape, reads never leave the server and writes go through Server Actions. Fewer
doors is fewer doors to lock.

The cost is real: you are learning TypeScript and React rather than reaching for
Blade and Eloquent. The documentation in this folder exists to offset that.

## Next.js and the App Router

Next.js is the framework. It handles routing, rendering, and running server code.

### Folders are routes

There is no route file. The URL is the path:

```
src/app/(admin)/leads/page.tsx        ->  /leads
src/app/(admin)/leads/[id]/page.tsx   ->  /leads/123
src/app/(auth)/login/page.tsx         ->  /login
```

Special filenames have fixed meanings: `page.tsx` is a page, `layout.tsx` wraps
everything beneath it, `loading.tsx` shows while data loads, `error.tsx` handles a
crash in that subtree.

A folder in parentheses like `(admin)` is a **route group**: it organises files and
lets that subtree share a layout, without appearing in the URL. `/leads`, not
`/admin/leads`. It is how the whole authenticated area gets one auth check and one
shell.

### Server Components: the important idea

By default, a component runs **on the server only**. It can query the database
directly, and the browser receives just the resulting HTML:

```tsx
// This entire function runs on the server. Nothing here is sent to the browser.
export default async function LeadsPage() {
  const leads = await db.select().from(leadsTable).limit(50);
  return <LeadsTable rows={leads} />;
}
```

Compare that to the shape you would otherwise need: a controller, a JSON endpoint,
an authorisation check on that endpoint, a fetch call in the browser, loading
state, error state. Here there is one function, and the database credentials never
leave the server because that code never reaches the browser.

A component needs `'use client'` at the top only when it uses something that
requires a browser: `useState`, an `onClick` handler, a chart library. Those
components ship to the browser, so they must not import anything secret.

The rule of thumb: **server by default, client only where there is interaction.**

### Server Actions: how writes work

A Server Action is a function marked `'use server'` that a form can submit to
directly:

```ts
'use server';

export async function createLead(formData: FormData) {
  const user = await requireAuth(); // authorisation first, always
  const data = leadSchema.parse(Object.fromEntries(formData)); // then validation
  await db.insert(leadsTable).values(data);
}
```

Next.js turns that into an HTTP endpoint behind the scenes and wires the form up.
You do not write a route, a fetch call, or JSON serialisation.

**The security point that matters most in this codebase:** although it reads like
a private function, a Server Action _is_ a public HTTP endpoint. Anyone can call
it with any arguments. It being unreachable from your UI proves nothing. So every
action starts with an authorisation check and then validates its input with Zod.
That is rule 3 and rule 4 in `AGENTS.md`, and it is the single easiest way to put
a hole in this application.

## TypeScript

JavaScript with type annotations, checked before the code runs.

```ts
function daysSince(date: Date): number { ... }

daysSince('2026-03-04'); // refuses to compile: string is not a Date
```

Why it earns its keep here: this app has a lot of shaped data - a lead has around
twenty fields, several of them optional, several referencing other tables. Drizzle
derives TypeScript types from your actual schema, so if you rename a column and
forget to update a query, `npm run typecheck` tells you immediately instead of
production telling you later.

The settings in `tsconfig.json` are stricter than default. The one worth knowing
is `noUncheckedIndexedAccess`: `rows[0]` is typed as _possibly undefined_, forcing
you to handle the empty-result case. That is exactly the bug that otherwise shows
up as "Cannot read properties of undefined" on a page that worked in testing.

## PostgreSQL instead of MySQL

Both are relational databases and most SQL you know transfers unchanged. Postgres
was chosen for four reasons that all matter to this specific application:

- **Analytics.** Window functions, `FILTER`, `DISTINCT ON` and CTEs make
  "top 10 sub-categories by demand this month, with each one's share of total"
  a single readable query instead of several plus post-processing in code.
- **Real strictness.** MySQL has historically accepted invalid dates and silently
  truncated data. Postgres rejects bad data. For records you make purchasing
  decisions from, rejection is the correct behaviour.
- **`timestamptz`.** Stores an unambiguous instant and converts on the way out.
  With a business in Qatar (UTC+3) and suppliers in Sri Lanka (UTC+5:30), this is
  not a hypothetical convenience.
- **Cheap correct constraints.** Partial unique indexes let you express "a phone
  number is unique among customers that are not deleted" directly in the schema.

### Timezone handling

Every instant is stored as `timestamptz` in UTC. It is converted to Asia/Qatar only
when displayed, or when grouping records by day.

This is not pedantry. "Days Since Contact" is a question about calendar days in
Doha. A customer who messaged at 01:00 Tuesday Doha time did so at 22:00 Monday
UTC; asked on Tuesday, naive UTC arithmetic reports the lead as a day old when it
is hours old. Use `@/lib/time` - the logic is written and tested in
`src/lib/time/calendar.test.ts`, and those tests exist precisely because this is
easy to get wrong and hard to notice.

## Drizzle ORM

You describe your tables in TypeScript, then write queries against them:

```ts
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerPhone: text('customer_phone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

const recent = await db.select().from(leads).where(eq(leads.customerPhone, phone));
```

Differences from Eloquent worth knowing:

- Queries look like SQL, not like objects. If you know SQL, you can read Drizzle.
- No lazy loading, so no N+1 queries by accident. You state your joins.
- Migrations are generated by diffing your schema file against the database:
  `npm run db:generate` writes the SQL, `npm run db:migrate` applies it. Review the
  generated SQL before applying it - it is a normal `.sql` file.

## Docker

You already have Docker working. Here is the mental model.

An **image** is a template - "PostgreSQL 17, configured, ready to run". A
**container** is a running copy of an image. A **volume** is a disk that survives
the container being deleted, which is where your data actually lives.

`docker/compose.dev.yml` declares two containers, PostgreSQL and Redis, and gives
each a volume. `npm run dev:up` starts them; `npm run dev:down` stops them and
keeps the data; `npm run dev:destroy` deletes the volumes too.

Two deliberate choices:

**The app does not run in Docker during development.** Only the database and cache
do. Next.js runs natively via `npm run dev`, so hot reload stays instant. Docker
here exists purely so you never install or configure PostgreSQL and Redis by hand,
and so your local versions match the server exactly.

**The ports are offset**: PostgreSQL on 5433 instead of 5432, Redis on 6380
instead of 6379. Laragon's MySQL is untouched, and nothing can collide with a
default install later.

## Redis

An in-memory key-value store. Very fast, and it forgets things on purpose.

It is used for two things:

**Rate limiting.** Counting login attempts per IP, uploads per user. These counters
need to be fast, shared across processes, and automatically expiring - which is
precisely what Redis is for.

**Session lookups.** Checking the session on every request means a database read on
every request; Redis absorbs that.

You will not write Redis commands. It is infrastructure, like the web server.
There is a `DISABLE_REDIS=true` escape hatch with an in-memory fallback for local
work, which the env validation refuses to allow in production - in-memory counters
reset on restart and are not shared between processes, so rate limiting would look
like it worked while not working.

## Authentication and authorisation

Two separate questions, answered in two separate places: who you are, and what you
may do.

**Who you are** is Better Auth's job, with three things configured on top of it.

Accounts are invite-only. Better Auth's sign-up endpoint is switched off, and the only
routes to an account are the Team page and `npm run auth:create-owner` for the very
first one. An invitation is a random 32-byte token, stored only as a SHA-256 hash, good
for one use and seven days. The role is fixed by whoever sent the invitation, never by
the person accepting it.

Two-factor is mandatory. A correct password on an enrolled account produces no
session at all - the two-factor plugin creates one, deletes it, and hands back a
short-lived challenge instead. A new account is sent to enrolment before it can reach
any page. `npm run auth:probe` asserts exactly this, because it is the property the
rest of the design leans on.

Better Auth's HTTP handler is deliberately **not** mounted at `/api/auth/*`. That would
publish thirty-odd endpoints when this application needs five. Instead the Server
Actions in `src/features/auth/` call `auth.api.*` directly, in the same process.

**What you may do** is one file: `src/lib/auth/roles.ts`. Four roles, eight resources,
five actions, and a plain table of grants. A permission absent from the table is
denied, so a new resource is inaccessible until someone deliberately grants it. It is
a table rather than scattered `if (user.role === 'owner')` checks because a policy you
cannot read in one sitting is a policy nobody audits.

Every page starts with `requireUser()` or `requirePermission()`; every Server Action
starts with `authorize()`. Both are needed, and neither substitutes for the other:

> A Server Action is a public HTTP endpoint no matter how much it looks like a
> function call. Being unreachable from the navigation is not access control.

`src/proxy.ts` also redirects visitors with no session cookie, but that is a shortcut
to avoid rendering a layout that is about to redirect anyway. It reads no database and
decides no permissions. Treating it as the security boundary is how applications end
up with one unguarded endpoint nobody noticed.

Every change to data, and every security event worth knowing about, writes an
`activity_log` row: who, what, when, from which address. Nothing updates or deletes
those rows, and no role is granted a write on them.

## Two design systems, one set of components

The back office and the future public site look deliberately unalike, and the
difference is not decoration.

A shop window is glanced at. It should feel like a boutique: Cormorant Garamond
headings, Jost body text, wide uppercase Marcellus labels, square corners, flat
cream surfaces. That is the reference homepage in `reference/`, and it stays.

The back office is stared at for an hour while comparing numbers in a table. It
follows ordinary dashboard convention instead - Inter at four weights, 14px body
text, 6px corners, sentence-case labels, tabular figures - because convention is
what lets someone who has used one admin tool use this one without learning to
see it first. Serif headings and tracked-out capitals cost real reading speed at
these sizes, and a table is nothing but small text.

What the two share is **colour**. Both themes draw from the same brand palette in
`src/lib/theme/tokens.ts`, so the back office is unmistakably Ceylon Collection:
navy surfaces, gold accents, the same status tones.

The mechanism is that a theme carries more than colour. Alongside `surface`,
`ink` and the rest, `ThemeTokens` has:

| Group       | What it decides                                             |
| ----------- | ----------------------------------------------------------- |
| `typeface`  | display, body and label font stacks                         |
| `corner`    | radius for controls and for panels - `0` on the public site |
| `elevation` | panel and overlay shadows - `none` on the public site       |
| `label`     | case, weight and tracking of small labels                   |

So `Button`, `Card`, `Badge` and the field components never ask which world they
are in. They use `rounded-control`, `shadow-panel` and the `eyebrow` utility, and
the theme decides what those mean. One component, two houses.

Two consequences worth remembering:

- **Do not hardcode a typeface, a radius or a shadow in a component.** The one
  exception is `BrandMark`, which names Marcellus directly, because a logotype is
  identity rather than interface and should not change with the theme.
- `tokens.test.ts` asserts the split - Inter in the admin themes, the brand
  pairing on the public site, rounded versus square, sentence case versus
  capitals. Unifying them by accident fails CI.

## The taxonomy

Ten lists - statuses, platforms, garment gender, sizes, cities, urgency, fabrics,
categories, sub-categories, tags - describe every lead. They are **tables, not
enums**, because every one of them will change: a new fabric arrives, a platform
stops being used, a sub-category turns out to be two. As an enum each change is a
migration and a deploy; as rows it is an edit on a page.

Three distinctions in there are worth knowing, because they are what make the rest
safe.

**Name versus slug.** The name is yours to change. The slug is generated from it
once, at creation, and then never moves - not even when the name does. Three things
depend on that: the seed script, which must be safe to re-run; the n8n intake,
which arrives with text like `whatsapp` and has to resolve it without a human; and
the CSV import of your existing spreadsheet. Rename "Lost/Cancelled" to "Closed"
and every label updates while `lost-cancelled` keeps working.

**Retired versus deleted.** Retiring (`is_active` false) takes a value out of the
dropdowns and leaves it readable on every lead that already uses it - "Imo", when
nobody uses Imo any more. Deleting (`deleted_at`) is for a value created by
mistake, needs the `taxonomy:delete` permission, and is refused while anything
points at the row. Because nothing is ever hard-deleted, leads can reference these
rows with `on delete restrict` and no lead can lose its history.

**Order is data.** The status list is the funnel, and a picker that offers
"Delivered" above "Contacted" invites mistakes. Position is `sort_order`, counted in
tens so a value can be slotted between two others, and it is changed only by the
move buttons - which swap two rows in one transaction. It is deliberately not a
form field: an edit submitted without it would silently send the row to the top.

One page serves all ten lists. What differs between them - the extra columns, the
labels, whether rows hang off a parent - is declared in
`src/features/taxonomy/registry.ts`, and the Zod schemas are generated from it, so
a new taxonomy cannot arrive with an unvalidated field. `registry.test.ts` compares
the registry against the actual table columns, so a column nobody declared fails CI
rather than being invisible in the UI.

Sub-category slugs are unique **per category** rather than globally. That is not an
oversight: the business's own list has "Batik Saree" under both Batik Wear and
Sarees & Osari, because one is a craft and the other a garment type.

## Photos on a lead

The photo is often the enquiry. "The green one in your third post" cannot be sourced
from; a screenshot of that post can. So a lead can carry reference photos, and three
decisions in that feature are worth knowing.

**Every upload is decoded and re-encoded, never stored as it arrived.** That single
step does four things: it drops the EXIF block, which on a phone photo contains GPS
coordinates and the device - a customer sending a picture of a dress has not agreed to
hand over their home address; it means the bytes we serve were generated from decoded
pixels, so nothing executable in the original survives; it turns a 12-megapixel HEIC
into a WebP of a few hundred kilobytes, which on Qatari mobile data is the difference
between a gallery that loads and one nobody waits for; and it gives us a thumbnail, so
a grid of photos costs 40KB each rather than 400KB.

There is a subtlety in that: EXIF is also what says "this photo is rotated 90°", so
the rotation has to be _applied_ before the metadata is discarded, or every second
iPhone picture ends up sideways. `prepare.test.ts` asserts both halves - that the GPS
tags are gone and that a portrait photo comes out portrait.

Before any of that, the file's first bytes are checked against known signatures
(`lib/images/sniff.ts`) and anything that is not a picture is refused. The interesting
upload is not a large file; it is a file called `photo.jpg`, declared `image/jpeg`,
that is really an HTML document. The browser's `file.type` and the extension are both
claims made by whoever uploaded it.

**There is one HTTP endpoint, and it is this.** The rule elsewhere is no
browser-facing API: reads in Server Components, writes in Server Actions. An `<img>`
tag can be neither - the element issues its own GET, and no component can hand it
bytes. The alternative is inlining every photo as a `data:` URL, which defeats
caching, prevents lazy loading, and puts megabytes of base64 into the HTML. So
`/lead-images/[id]/[variant]` exists, read-only, and it applies the same checks in the
same place as a page: a session, `leads:read`, and the image must belong to a lead that
is not soft-deleted. **The object key comes from the database, never from the URL** -
the URL carries an id which is looked up - which is what makes path traversal
impossible here rather than merely unlikely. Refusals are 404, not 403, so the route
cannot be used to discover which ids exist.

**Deleting a photo deletes the file.** This is the one table that is not soft-deleted,
and the reason is that the usual motive for removing a photo is that it should not be
held at all: the wrong customer's picture, a face nobody agreed to store. A soft delete
would leave the bytes on disk and make the button a lie; keeping the row while
destroying the file leaves a record whose only content is a broken pointer. So both go,
and the audit trail lives where audit trails belong - `activity_log` records who
removed which photo from which lead. Whoever uploaded a photo may remove it even if
their role cannot delete leads, because "wait for a manager" is the option with the
real privacy cost.

Files live under `STORAGE_LOCAL_DIR` behind a small interface (`lib/storage`), which is
not `public/`: nothing in there is served by Next.js. The interface exists because the
destination will change - a Docker volume on the VPS now, object storage when the photo
count makes backing up a volume unpleasant.

## Importing the spreadsheet

`/leads/import` reads a CSV and, before writing anything, tells you what importing it
would do: a verdict for every line, every problem named with its line and column, and
every value it could not place. Only then is there a button that writes.

That shape - **plan, then commit** - is the whole design, and it is there because a
spreadsheet kept by hand is never clean. Dates are typed three ways, the same customer
appears as `33124455` and `+974 3312 4455`, a fabric is spelled wrong, a row is a
duplicate of the row above. The alternative designs are both bad: refusing the whole
file over one bad cell wastes the other four hundred rows, and importing what it can
while quietly dropping the rest leaves you unable to tell what is missing. So every row
is judged independently, and every rejection says what to fix.

Four decisions inside it are worth knowing.

**Nothing is invented.** A fabric that is not in the taxonomy is a rejected row with a
link to `/taxonomy/fabrics`, not a new fabric. If the importer created values, one typo
would become a permanent list entry and the analytics would split one fabric across two
names. Unplaced values are reported once with a row count, so the fix is one visit to
the taxonomy page and one re-upload.

**Re-importing the same file is safe.** Each lead gets a fingerprint - phone, day,
sub-category, fabric, size, quantity, and the normalised request text - and a row whose
fingerprint already exists in the database is reported as `present` rather than written
again. A row that repeats an earlier line in the same file is `duplicate`. This matters
because the natural way to use a dry run is to fix three cells and upload the whole
sheet again.

**The report is not trusted.** The commit step re-reads the file and plans it from
scratch; it does not import the rows a report claimed were valid. What comes back from
the browser is a string that arrived over HTTP, and in the minutes a report sat on
screen the taxonomy may have changed or someone may have entered one of those leads by
hand. The rows written are the ones the server has just decided are valid.

**Ambiguity is a question, not a guess.** "Batik Saree" exists under two categories, so
a row naming only the sub-category is rejected and asks for the category column. The
importer will not pick one.

The parser is ours (`src/lib/csv.ts`, RFC 4180, with delimiter sniffing and BOM
stripping) rather than a dependency, because the awkward parts - a quoted field
containing a newline, a sheet Excel saved with semicolons - are a hundred lines and are
worth being able to read. `public/lead-import-template.csv` is the header order the
form links to, and `columns.test.ts` fails if that file and the internal column
definitions ever disagree.

## Analytics: boards, not one dashboard

Charts are drawn with **Chart.js**, and the reports are split into **boards** - one
subject per page. Demand exists now; money, stock and orders are stubs on
`/analytics` with a "Planned" badge.

That split is the important decision, and it is a decision about the future rather
than about today. Leads are the only thing measured so far, but income, spending,
landed cost, stock and margin are all coming. The natural way to add them is a
section per subject on one growing dashboard, and the reliable result of that is
thirty charts where the important one is below the fold - and where adding a chart
means arguing about what to remove. A board is a sitting: "how is demand?" and "did
last month make money?" are asked at different times, over different periods, and
often by different people.

So the code is split the same way:

| Where                              | What lives there                                    |
| ---------------------------------- | --------------------------------------------------- |
| `src/features/analytics/`          | the presentation layer, borrowed by every board     |
| `src/features/analytics/boards.ts` | the registry: which boards exist, which are planned |
| `src/features/leads/analytics.ts`  | the SQL behind the demand board                     |

Whoever owns the tables owns the queries: `features/leads/analytics.ts` holds the
demand SQL, and a future `features/stock/analytics.ts` will hold its own. What is
shared is everything that is not about leads:

- **The period** (`range.ts`). Every board is read through the same control, and every
  range knows the equal-length period before it, so any figure can show a change
  without each board inventing its own idea of "before". Presets are stored as
  `?range=90d` rather than two dates, so a bookmark still means "last 90 days" next
  month.
- **The long tail** (`slice.ts`). There are 200-odd sub-categories, and a chart with
  200 bars communicates nothing. `topSlices` keeps the leading few and folds the rest
  into one, keeping the true total so percentages still refer to everything. Expense
  categories and suppliers will have the same shape of tail.
- **Time buckets** (`buckets.ts`). The bucket size follows the span - days, weeks,
  then months - and every bucket in the period is produced, **including the empty
  ones**. Postgres returns no row for a silent week, and a line drawn from those rows
  joins the week before to the week after, which reads as steady demand across a gap
  where there was none.
- **The chart itself** (`components/`). One client component talks to Chart.js. Boards
  describe charts as plain data - kind, labels, values, a unit - because a Server
  Component can only pass serialisable props, and Chart.js configuration is full of
  callbacks. Colours are read from the live CSS variables rather than imported, so a
  chart cannot disagree with the page around it and both themes work with no chart
  code aware there are two.

Three habits in there are worth keeping when the money and stock boards arrive.

**Aggregate in Postgres.** Every figure is a `count`, `sum` or `filter (where ...)`
over an indexed column. Fetching rows and counting them in JavaScript works for the
fortnight when there are forty of them and is slowest in exactly the situation the
business is working towards.

**Group by the day in Qatar, not in UTC.** `contacted_at` is stored as `timestamptz`;
grouping it without `at time zone` first puts a 01:00 Doha message on the previous
day, so every daily figure is quietly wrong by however many messages arrive before
03:00.

**A number needs its comparison, and a chart needs its caption.** Metrics show the
change against the previous period, but never colour it green or red on their own -
"down" is good news for expenses and bad news for income, so the caller says which
direction is favourable. Charts that leave rows out say how many: the sub-category
chart drops enquiries that named no sub-category, and prints the count underneath,
because a large number there is itself the finding.

Charts are canvases, which are invisible to a screen reader, so every one renders the
same numbers as a visually hidden table beside it.

For something to look at before the first real enquiry, `npm run db:demo` invents
about 140 leads over 90 days, and `npm run db:demo -- clear` removes them again. It
refuses to run against a production deployment.

## Configuration

`src/lib/env/schema.ts` declares every variable the app needs, with rules. On
startup, `src/instrumentation.ts` validates the environment. Anything missing or
malformed stops the server with a message naming the variable and how to fix it.

The alternative - `process.env.WHATEVER` scattered around, silently `undefined` -
fails hours later in a way that is genuinely hard to trace. ESLint blocks direct
`process.env` reads outside that module.

There is one subtlety worth understanding, because it looks like duplication:

- `NODE_ENV` is **how the code was compiled**. Next.js forces it to `production`
  for any `next build`, including one you run on your laptop.
- `APP_ENV` is **where this instance is running**, and it is what switches on the
  strict production rules: HTTPS required, Redis required, no placeholder secrets.

Without that split, you could not build and test a production build locally, since
`NODE_ENV=production` plus `http://localhost` would be rejected. The obvious risk -
deploying and forgetting to set `APP_ENV=production`, silently disabling every
check - is closed by a rule that rejects a non-local `APP_URL` while `APP_ENV` is
still `development`. Both directions are tested in `src/lib/env/schema.test.ts`.

### The configuration is server-only, and the compiler enforces it

`src/lib/env/index.ts` imports the `server-only` package. That one line converts a
nasty class of mistake from a runtime error into a build error.

The mistake is never obvious, because it is never direct. A `'use client'` component
imports a constant from a module that looks like pure business rules; that module
imports one date helper from `@/lib/time`; `@/lib/time` reads the configured timezone
from `@/lib/env`. The browser copy of that chain validates `process.env`, which the
bundler has replaced with the `NEXT_PUBLIC_*` variables only, and the page dies with
`DATABASE_URL is required` - pointing at the environment, which is fine, instead of at
the import, which is not. Both leaks that existed were found this way.

The build now names the offending file and prints the import trace. The rule to follow:
when a client component needs a constant that lives next to server code, move the
constant into a module with no imports of its own - `features/analytics/presets.ts` is
the pattern - rather than reaching into the server module for it.

Two consequences to know about, both because the real `server-only` package throws
unless it is resolved under React's `react-server` condition:

- The npm scripts that run TypeScript through `tsx` pass `--conditions=react-server`.
  If a new script fails with "cannot be imported from a Client Component module", it is
  missing that flag, not doing anything wrong.
- Vitest aliases the package to `tests/stubs/server-only.ts`, a no-op. Tests are server
  code by definition.

## Where things live

```
src/app/          routes. (admin) is authenticated, (auth) is not
src/features/     one folder per domain area: leads, customers, taxonomy
src/components/   shared UI primitives
src/db/           schema, migrations, seed data
src/lib/          env, logger, time, auth, storage
docker/           compose files for local dev and production
scripts/          standalone Node scripts: doctor, setup, wait-for-db
reference/        original brand and design source material - do not edit
docs/             this folder
```

Code is grouped by **feature**, not by kind. Everything about leads - queries,
actions, validation schemas, components - lives in `src/features/leads/`, because
that is how you will actually work: on a feature, not on "all the validators".
