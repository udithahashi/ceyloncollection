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
