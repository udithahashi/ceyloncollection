# Troubleshooting

## Start here

```bash
npm run doctor
```

It checks Node, dependencies, configuration, Docker, the containers, both ports,
and a real database query, and prints the exact command to fix whatever failed.
Most problems below are things it will already have told you.

---

## Docker

### "Cannot connect to the Docker daemon" / "docker: command not found"

Docker Desktop is not running, or not installed. Start it and wait until the whale
icon in the tray stops animating - the CLI reports this error the whole time it is
still starting.

### Docker Desktop hangs on "Starting..."

Restart the WSL 2 backend it runs on:

```powershell
wsl --shutdown
```

Then reopen Docker Desktop. If it still hangs, reboot: Windows sometimes needs one
after a WSL update before virtualisation works again.

### "port is already allocated"

Something already holds 5433 or 6380. Find it:

```powershell
netstat -ano | findstr :5433
```

The last column is the process id; look it up in Task Manager's Details tab. The
likely cause is an older copy of these containers still running:

```bash
npm run dev:down
npm run dev:up
```

### The database container keeps restarting

Read what it is complaining about:

```bash
npm run dev:logs
```

Usually the volume was initialised with a different password than `.env.local` now
contains. The password is only applied when the data directory is first created, so
changing it later has no effect. Recreate from scratch:

```bash
npm run dev:reset
```

This deletes all local data.

---

## Configuration

### "Invalid environment configuration. The app will not start."

Intentional. The message lists each offending variable and what is wrong with it.
Fix them in `.env.local` and restart.

### "must be at least 32 characters"

Generate a real secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### "is still the placeholder from .env.example"

A `CHANGE_ME` value survived setup. Replace it with a generated secret as above.

### "APP_URL points at ... but APP_ENV is development"

You are running against a real domain with development settings, which would
silently disable the production safety checks. Set `APP_ENV=production` in the
server environment.

### "must use https:// in production"

Session cookies are `Secure`-only, so a browser will not send them over plain HTTP -
you would get an infinite login loop. Put the app behind HTTPS and use the `https://`
URL in `APP_URL` and `BETTER_AUTH_URL`.

### `.env.local` changes seem to be ignored

Environment variables are read once at startup. Stop `npm run dev` and start it
again.

---

## Database

### "password authentication failed for user"

`DATABASE_URL` and the `POSTGRES_*` variables disagree. Docker creates the database
user from `POSTGRES_USER` / `POSTGRES_PASSWORD`, and the app logs in using
`DATABASE_URL`; if they drift apart, authentication fails. `npm run doctor` checks
for this specifically.

If you changed the password after the container already existed, the old password
is still in the volume. Recreate it:

```bash
npm run dev:reset
```

### "ECONNREFUSED 127.0.0.1:5433"

Nothing is listening. Either the containers are not running (`npm run dev:up`), or
PostgreSQL is still starting up - on a fresh volume it has to initialise the data
directory first, which takes a few seconds. `node scripts/wait-for-db.mjs` waits
properly.

### "database ... does not exist"

The database name in `DATABASE_URL` does not match `POSTGRES_DB`. Like the password,
the name is only used when the volume is first created, so a `npm run dev:reset` is
needed after changing it.

---

## Application

### Changes do not appear in the browser

Hard reload with `Ctrl+Shift+R`. If it persists, look at the terminal running
`npm run dev` for a compile error - the browser will keep showing the last good
version. Editing `next.config.ts` or `.env.local` requires a full restart.

### "Cannot read properties of undefined"

Usually an array index assumed to exist. `rows[0]` is `undefined` when a query
returns nothing, and `noUncheckedIndexedAccess` in `tsconfig.json` makes
TypeScript force you to handle that - so `npm run typecheck` should have caught it
before the browser did.

### "You're importing a component that needs ..."

A server-only module reached a Client Component. Anything importing `@/lib/env`,
`@/lib/logger`, or the database must not be reachable from a file marked
`'use client'`. Move the data access into a Server Component and pass the result
down as props.

### A form submits but nothing happens

Check the terminal, not the browser. Server Action errors are logged server-side.
The usual cause is a Zod validation failure, which is the system working - the
missing part is surfacing the error in the UI.

---

## Tooling

### The commit was blocked by the secret scan

Read what it flagged. If it is real, move the value into `.env.local` and read it
through `@/lib/env`. If a secret has already been committed or pushed, **rotate
it** - deleting it from history does not make the old value safe.

If it is a false positive, add a comment containing `secret-scan:allow` on that
line.

### `npm install` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`

A network appliance is intercepting TLS. Tell Node to trust the certificates
Windows already trusts:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm install
```

Do not disable `strict-ssl`. That turns a certificate problem into a supply-chain
one.

### Tests pass locally but fail in CI

CI has no `.env.local`. Any test that needs configuration must build its own, as
`src/lib/env/schema.test.ts` does. Tests of pure logic should not import anything
that reads the environment.

---

## Nothing here helped

Capture the state before changing anything:

```bash
npm run doctor
npm run dev:logs
```

The doctor output plus the last 50 log lines is usually enough to identify the
cause.
