# Local development

Day-to-day commands and workflows. For what the pieces _are_, see
[CONCEPTS.md](CONCEPTS.md). For when something breaks, see
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## First time on a new machine

```bash
npm install
npm run setup     # writes .env.local with freshly generated secrets
npm run dev:up    # starts PostgreSQL and Redis in Docker
npm run doctor    # verifies all of the above
npm run dev
```

`npm run setup` will not overwrite an existing `.env.local`. Pass `--force` if you
really mean to replace it; it keeps a `.env.local.backup`.

## Every day

```bash
npm run dev:up    # only if Docker was restarted; harmless to run anyway
npm run dev       # http://localhost:3000
```

Leave `npm run dev` running. Saved changes appear in the browser immediately.

When you are finished for the day, `npm run dev:down` stops the containers and
keeps your data. You can also just leave them running - they use very little when
idle, and Docker Desktop restarts them automatically.

## What runs where

```mermaid
graph LR
    Browser["Browser<br/>localhost:3000"]
    NextApp["Next.js<br/>npm run dev<br/>native, hot reload"]
    Postgres["PostgreSQL 17<br/>Docker :5433"]
    Redis["Redis 8<br/>Docker :6380"]

    Browser <--> NextApp
    NextApp --> Postgres
    NextApp --> Redis
```

The app itself is **not** in Docker during development, so hot reload stays fast.
Only the database and cache are containerised, so that you never have to install
or configure them, and so your local versions match the server.

Ports are deliberately non-default: PostgreSQL on **5433**, Redis on **6380**.
Laragon's MySQL and any future default install cannot collide with them.

## Container commands

| Command               | Effect                                                         |
| --------------------- | -------------------------------------------------------------- |
| `npm run dev:up`      | Start PostgreSQL and Redis in the background                   |
| `npm run dev:status`  | Show whether they are running and healthy                      |
| `npm run dev:logs`    | Follow their logs; `Ctrl+C` to stop watching                   |
| `npm run dev:down`    | Stop them, **keeping** all data                                |
| `npm run dev:destroy` | Stop them and **delete all local data permanently**            |
| `npm run dev:reset`   | Destroy, recreate, and wait until the database accepts queries |

`dev:destroy` and `dev:reset` erase your local database. That is often exactly what
you want - a clean slate is one command away - but nothing warns you first.

## Checking your work

```bash
npm run verify
```

That runs four things, and it is what CI runs too:

| Step                   | Catches                                          |
| ---------------------- | ------------------------------------------------ |
| `npm run typecheck`    | Type errors: wrong shapes, renamed columns       |
| `npm run lint`         | Bugs and rule violations, e.g. a missing `await` |
| `npm run format:check` | Formatting drift                                 |
| `npm run test`         | Broken logic                                     |

Individually useful:

```bash
npm run test:watch    # re-runs affected tests as you type
npm run lint:fix      # fixes what can be fixed automatically
npm run format        # reformats everything
```

## Git hooks

Installed automatically by `npm install`.

**On commit:** staged files are scanned for credentials, then formatted and linted.
The secret scan blocks the commit if it finds anything, because a secret that
reaches history is compromised permanently - removing it later does not help, since
the value was already pushed and cached. If it flags something that genuinely is
not a secret, add a comment containing `secret-scan:allow` on that line.

**On push:** typecheck and tests run. `git push --no-verify` skips this, for
emergencies only.

## Logs

Application logs are structured JSON, one object per line, so they can be searched
and filtered on the server. For readable output locally:

```bash
npm run dev:pretty
```

The logger redacts fields named like credentials (`password`, `token`, `secret`,
`cookie`, and similar) anywhere in a logged object. Do not rely on that alone -
never deliberately log a secret or a full phone number.

## Testing a production build locally

```bash
npm run build
npm start
```

This works against `http://localhost` because `APP_ENV` stays `development` even
though `NODE_ENV` becomes `production` during a build. See the configuration
section of [CONCEPTS.md](CONCEPTS.md) for why those are two separate variables.

## Adding a dependency

```bash
npm install <package>          # needed at runtime
npm install -D <package>       # only needed while developing or building
```

Then run `npm audit`. The project is currently at zero known vulnerabilities, and
it is worth keeping it there. One `overrides` entry already exists in
`package.json`, pinning a nested `esbuild` up to a patched version so that
`drizzle-kit` does not drag in a vulnerable copy.

## Editing configuration

Add the variable to **three** places, or startup will reject it:

1. `.env.example` - documented placeholder, committed
2. `.env.local` - your real value, never committed
3. `src/lib/env/schema.ts` - the validation rule

Then import it as `env.YOUR_VARIABLE` from `@/lib/env`. Reading `process.env`
directly is blocked by ESLint.
