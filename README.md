# Ceylon Collection

Private back office for a Sri Lankan clothing import business in Qatar.

The business imports good-quality Sri Lankan fabric and clothing and sells it to
customers in Qatar. Demand is discovered by posting on social media and talking to
people, which produces a steady trickle of enquiries across Facebook, WhatsApp,
Instagram, Imo and Viber. This application is where those enquiries become
structured data: who asked, for what, in which size and fabric, how urgently, and
what happened next.

The point is to be able to answer, with evidence, the question that decides each
import order: **what should I actually buy, and how much of it?**

There is no public website yet. Everything here is the admin side.

## Quick start

You need [Node.js 22+](https://nodejs.org) and
[Docker Desktop](https://docker.com/products/docker-desktop).

```bash
npm install          # install dependencies
npm run setup        # create .env.local with generated secrets (skips if it exists)
npm run dev:up       # start PostgreSQL and Redis in Docker
npm run doctor       # confirm everything is wired up correctly
npm run dev          # start the app at http://localhost:3000
```

If any step misbehaves, run `npm run doctor`. It checks the things that actually
go wrong and prints the exact command to fix each one.

## Commands

| Command               | What it does                                                   |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev`         | Start the app with hot reload                                  |
| `npm run dev:pretty`  | Same, with human-readable log output                           |
| `npm run doctor`      | Diagnose your local environment                                |
| `npm run dev:up`      | Start the PostgreSQL and Redis containers                      |
| `npm run dev:down`    | Stop them, keeping the data                                    |
| `npm run dev:destroy` | Stop them and **delete all local data**                        |
| `npm run dev:reset`   | Destroy, recreate, and wait until the database is ready        |
| `npm run dev:logs`    | Follow the container logs                                      |
| `npm run dev:status`  | Show container status                                          |
| `npm run verify`      | Typecheck, lint, format check, and run tests - run before push |
| `npm run test`        | Run unit tests once                                            |
| `npm run test:watch`  | Re-run tests as you edit                                       |
| `npm run build`       | Production build                                               |

## Documentation

| Document                                           | Read it when                                            |
| -------------------------------------------------- | ------------------------------------------------------- |
| [docs/HANDOVER.md](docs/HANDOVER.md)               | You are picking the project up, or handing it over      |
| [docs/CONCEPTS.md](docs/CONCEPTS.md)               | You want to understand the stack and why it is this way |
| [docs/LOCAL-DEV.md](docs/LOCAL-DEV.md)             | You are working day to day                              |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Something is broken                                     |
| [docs/GLOSSARY.md](docs/GLOSSARY.md)               | You hit a term you do not recognise                     |
| [AGENTS.md](AGENTS.md)                             | Project conventions and rules, for humans and AI alike  |

## Stack

Next.js 16 (App Router) and React 19 for both the pages and the server logic,
PostgreSQL 17 through Drizzle ORM, Redis for sessions and rate limiting, Tailwind
CSS 4 for styling, and Better Auth for authentication. It runs as a single
application: there is no separate API service, and no REST API exposed to the
browser. Pages read from the database directly on the server, and forms submit to
Server Actions.

`docs/CONCEPTS.md` explains what each of those words means and why it was chosen.

## Design

Two design systems share one set of components, because the two audiences are
not the same.

The back office looks like a dashboard, deliberately: Inter throughout, 14px
body text, softly rounded corners, sentence-case labels, tabular figures. It is
a tool used for long stretches, and following convention is what makes a tool
feel obvious.

The public site, when it arrives, keeps the brand's editorial character from the
reference design in `reference/`: Cormorant Garamond headings, Jost body copy,
Marcellus in wide uppercase, square corners, flat cream surfaces.

Both draw from the same brand palette, so the back office still reads as Ceylon
Collection - navy, gold, and the same status colours. Typeface, corner radius,
elevation and label style are theme tokens rather than component decisions,
which is what allows one `Button` to be correct in both. Every colour pairing is
asserted against WCAG AA in `src/lib/theme/tokens.test.ts`.

## Security posture

This holds real customers' names and phone numbers, so it is built as a closed
system rather than a public app with a login page bolted on:

- No public sign-up. Accounts are created by invitation only, with TOTP two-factor.
- No browser-facing REST API. The only HTTP endpoints are the HMAC-signed n8n
  integration routes, bound to the internal Docker network.
- Every input validated with Zod at the boundary; every write authorised and
  recorded in an audit log.
- Uploaded images are re-encoded server-side, which strips EXIF and GPS data and
  neutralises files that merely pretend to be images.
- Secrets never enter git: a pre-commit hook scans staged changes and blocks them.
