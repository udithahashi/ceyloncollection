# Glossary

Terms you will meet in this codebase, in plain language. Where something maps onto
Laravel or PHP, that comparison is given.

## The stack

**Next.js** — The framework. Handles routing, server-side logic, and rendering.
Occupies the place Laravel does, but for both the pages and the server code.

**App Router** — The routing system where a folder path is the URL.
`src/app/leads/page.tsx` serves `/leads`. Replaces a routes file.

**React** — The library for building UI from components. Roughly Blade, if Blade
templates were functions that could hold state.

**Component** — A function returning markup. The unit of UI.

**Server Component** — A component that runs only on the server. Can query the
database directly. The browser receives the resulting HTML, never the code. The
default in this project.

**Client Component** — A component marked `'use client'` that also runs in the
browser, because it needs interactivity: state, click handlers, charts. Must never
import secrets.

**Server Action** — A function marked `'use server'` that a form submits to
directly. Roughly a controller method, minus the route declaration. **Security
note:** it is a real public HTTP endpoint, so it must authorise and validate every
call.

**TypeScript** — JavaScript with types, checked before the code runs.

**Tailwind CSS** — Styling by composing small utility classes in the markup
(`class="flex gap-4"`) instead of writing separate CSS rules.

**PostgreSQL** — The database. Like MySQL, stricter and stronger at analytics.

**Drizzle ORM** — The query builder. Tables described in TypeScript; queries that
read like SQL. Occupies Eloquent's place.

**Redis** — An in-memory key-value store used for rate limiting and session
lookups. Fast, and forgets things on purpose.

**Better Auth** — The authentication library: sessions, passwords, two-factor.

**Zod** — Runtime validation. Describe the shape data must have; Zod checks it and
gives you a typed result. Laravel's form request validation, roughly.

**Vitest** — The test runner. PHPUnit's counterpart.

**pino** — The logger. Writes structured JSON, one object per line.

**n8n** — A workflow automation tool already running on the VPS. Will watch for
incoming messages and push them into the lead intake queue.

## Infrastructure

**Docker** — Runs software in isolated, preconfigured environments so you do not
install and configure PostgreSQL and Redis by hand. Comparable to what Laragon does
for you, but explicit and identical on every machine.

**Image** — A template: "PostgreSQL 17, ready to run".

**Container** — A running instance of an image.

**Volume** — Storage that outlives its container. Where your data actually is.
Deleting a volume deletes the data.

**Docker Compose** — Declares a set of containers in one file, started together.
`docker/compose.dev.yml` is ours.

**VPS** — The rented Linux server (Contabo) where this will run in production.

**Reverse proxy** — The server that terminates HTTPS and forwards requests to the
app. Already running on the VPS for n8n.

**GHCR** — GitHub Container Registry. Where CI publishes the built image for the
VPS to pull.

## Data and domain

**Lead** — One enquiry from one customer: what they want, in which fabric and size,
how urgently, and its current status. The core record.

**Customer** — A person, identified by phone number. One customer, many leads.

**E.164** — The international phone number format (`+97455123456`). Storing every
number this way makes "have we spoken to this person before?" a reliable question.

**Taxonomy** — The editable lookup lists: statuses, platforms, categories,
sub-categories, fabrics, sizes, genders, cities, urgency levels, tags.

**Soft delete** — Marking a row deleted with a `deleted_at` timestamp rather than
removing it, so history and references survive.

**Audit log / activity log** — A record of who changed what and when.

**Staging table** — Where automated intake from n8n lands for review before being
accepted as a real lead. Prevents an automation bug from corrupting real records.

**Top-N** — Showing only the leading few values in a chart. Necessary because there
are hundreds of sub-categories and a chart of all of them communicates nothing.

## Technical terms

**Environment variable** — Configuration supplied from outside the code, so secrets
and per-environment settings stay out of git. `.env.local` locally.

**`APP_ENV` vs `NODE_ENV`** — `NODE_ENV` is how the code was compiled and is forced
to `production` by any build. `APP_ENV` is where the instance is running, and is
what enables the strict production checks. See CONCEPTS.md.

**Migration** — A versioned schema change, applied in order.

**Seed** — Code that inserts starting data, such as the taxonomy lists.

**`timestamptz`** — A PostgreSQL timestamp that stores an unambiguous instant, so
converting between UTC and Asia/Qatar is exact.

**HMAC signature** — Proof that a request came from someone holding the shared
secret and was not modified in transit. Used on the n8n endpoints.

**Rate limiting** — Capping how often an action can be attempted, to blunt
brute-force and abuse.

**CSP (Content-Security-Policy)** — A header telling the browser which sources of
script and style are allowed, which contains the damage if untrusted content is
ever injected.

**Nonce** — A single-use random value. In a CSP, it marks the one inline script the
browser should trust on this request.

**TOTP** — Time-based one-time password: the six-digit code from an authenticator
app.

**Magic bytes** — The first few bytes of a file, which identify its real type. A
file named `.jpg` can be anything; its magic bytes are much harder to fake.

**EXIF** — Metadata embedded in photos, often including GPS coordinates. Stripped
from every upload by re-encoding.

**ORM** — Object-Relational Mapper. Lets you query the database in your programming
language instead of writing raw SQL.

**Hot reload** — Saved changes appearing in the browser without a manual refresh.

**CI (Continuous Integration)** — Automated checks that run on every push.
