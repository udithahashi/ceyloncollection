# Deploying to Hostinger Node.js Web Apps

The app on Hostinger's managed Node.js hosting, redeploying itself on every push to
`main`; PostgreSQL and Redis stay on the owner's own VPS.

The alternative is [DEPLOYMENT.md](DEPLOYMENT.md), which runs everything on the VPS in
Docker. Read [Phase 0](#phase-0---what-this-costs-you) before choosing.

## Progress

Work through the phases in order. Each one ends with something you can check.

| Phase                                                        | You end up with                             |
| ------------------------------------------------------------ | ------------------------------------------- |
| [0. What this costs you](#phase-0---what-this-costs-you)     | A decision, made knowingly                  |
| [1. Get a green build](#phase-1---get-a-green-build)         | Hostinger builds without errors             |
| [2. PostgreSQL on the VPS](#phase-2---postgresql-on-the-vps) | A database reachable over TLS               |
| [3. Redis on the VPS](#phase-3---redis-on-the-vps)           | A cache reachable over TLS                  |
| [4. Create the schema](#phase-4---create-the-schema)         | Tables, taxonomy, and your owner account    |
| [5. Domain and SSL](#phase-5---domain-and-ssl)               | `https://ceyloncollection.qa` serving pages |
| [6. Verify](#phase-6---verify)                               | Proof it is really working                  |
| [7. Day to day](#phase-7---day-to-day)                       | How to deploy from now on                   |

---

## Phase 0 - What this costs you

Four things change when the app leaves the VPS. None is a reason not to do it, but all
four are easier to accept now than to discover later.

**1. Uploaded lead photos may not survive a deploy.** `STORAGE_DRIVER=local` writes lead
photos to disk. On the VPS that disk is a Docker volume and persists. On Hostinger it
depends on something Hostinger does not document.

_Certain:_ the standalone server calls `process.chdir(__dirname)` at startup, so its
working directory is `.next/standalone`. `STORAGE_LOCAL_DIR` is resolved with
`path.resolve(process.cwd(), ...)` in `src/lib/storage/index.ts`, so the default relative
`./storage/uploads` lands **inside the build output**, which every build replaces. Left
at the default, photos are definitely lost. Phase 1 sets an absolute path instead.

_Unverified:_ whether that absolute path survives a deploy. Phase 6 step 6 is the test
that settles it. If it fails, the fix is code - `src/lib/storage/index.ts` has an
`s3Storage` stub that deliberately throws, and finishing it (S3 / Cloudflare R2 /
Contabo Object Storage) is the answer.

**2. PostgreSQL and Redis have to face the internet.** Today they only listen inside the
VPS's Docker network. Phases 2 and 3 open them with TLS and long passwords rather than
by opening a port and hoping.

**3. `/n8n/intake` becomes a public endpoint.** `docker/Caddyfile` returns 404 for
`/n8n/*` from the internet, and n8n reaches the app over the internal Docker network.
Once the app is on Hostinger that is impossible - n8n is on the VPS and the app is not.
Use the **HMAC signature** credential, never the bearer-token fallback: the rate limit
and signature check in `src/app/n8n/intake/route.ts` were written as defence in depth
behind that Caddy rule, and on Hostinger they are the only defence.

**4. The app sleeps.** Hostinger's docs state that Node.js apps run on demand and the
process is stopped after a period without traffic. The first request after a quiet spell
pays a cold start, and both the PostgreSQL pool and the Redis connection rebuild -
`src/db/client.ts` and `src/lib/redis/client.ts` stash theirs on `globalThis`, which
survives hot reloads but not a stopped process. Not a bug; just do not read the first
slow page of the morning as one.

> The VPS stack in [DEPLOYMENT.md](DEPLOYMENT.md) has none of these four, and it is
> `docker compose up -d`. Choose Hostinger because you want managed hosting, not because
> it is less work.

---

## Phase 1 - Get a green build

The first Hostinger build fails on `better-sqlite3`. This phase fixes that and sets the
configuration the build needs. **Nothing here needs the VPS**, so you can get to a green
build before touching PostgreSQL or Redis.

### 1.1 Why it failed

The log ends with:

```
npm error path .../node_modules/better-sqlite3
npm error command sh -c prebuild-install || node-gyp rebuild --release
npm error prebuild-install warn install /lib64/libm.so.6: version `GLIBC_2.29' not found
npm error SyntaxError: invalid syntax
```

Three things went wrong in a row, and only the third is fatal:

1. `better-sqlite3` is a native module with an install script. It is not something this
   app uses - it arrived as a dependency of `@better-auth/cli`, a dev tool for one
   script.
2. Its prebuilt Linux binary needs `GLIBC_2.29`. Hostinger's build host is CloudLinux 8,
   which has an older glibc, so the download is unusable and npm falls back to compiling
   from source.
3. Compiling needs `node-gyp`, which needs Python 3.8 or newer. The host has Python
   3.6.8, so gyp's own source code is a syntax error to it.

You cannot fix 2 or 3 - they are the host's. So the fix is 1: stop installing the
package at all.

### 1.2 The fix (already committed to this repo)

Two changes in `package.json`:

- **`@better-auth/cli` removed from `devDependencies`.** It was the only thing pulling in
  `better-sqlite3`. Removing it dropped 114 packages, and `npm audit` went from a
  critical plus two high advisories - the ones `.github/workflows/ci.yml` has a comment
  apologising for - to **zero**. `npm run auth:schema-check` still works; it now fetches
  the tool with `npx` when you actually run it, instead of installing it forever.
- **`build` now finishes the standalone output itself:**
  `next build && node scripts/prepare-standalone.mjs`.

  `next.config.ts` sets `output: 'standalone'`, which writes a self-contained server to
  `.next/standalone/server.js`. Next deliberately leaves `public/` and `.next/static/`
  out of that folder because it assumes a CDN serves them. On Hostinger nothing else is
  serving anything, so without them the app boots perfectly and renders every page **with
  no CSS, no JavaScript and no images**. `scripts/prepare-standalone.mjs` copies them in.

  Folding it into `build` rather than a separate script is deliberate: Hostinger's Build
  command field offers `npm run build` and nothing else, so `npm run build` has to be the
  command that does everything.

### 1.2b The second failure: Next's own compiler

Fixing the install exposes the same root cause one layer up:

```
⚠ Attempted to load @next/swc-linux-x64-gnu, but an error occurred:
  /lib64/libm.so.6: version `GLIBC_2.29' not found
⨯ Failed to load next.config.ts
Error: Cannot find module '.../6a90bda0b22e0.next.config'
```

Hostinger's build host has **glibc 2.28**. Next 16's native binary needs **2.29**. The
musl build is not a way out - `@next/swc-linux-x64-musl` declares `libc: ["musl"]`, so
npm will not install it on a glibc host. Next falls back to its WebAssembly compiler,
and the wasm compiler cannot compile a TypeScript `next.config.ts`, which is what that
second error is: a temp file that was never written.

Three more changes, all committed:

- **`next.config.ts` became `next.config.mjs`.** Node imports it directly, so nothing has
  to compile it. The cost is that it can no longer import `MAX_UPLOAD_TOTAL_BYTES` from
  `src/lib/images/limits.ts`, so that number is restated - and
  `tests/next-config.test.ts` fails if the two ever disagree.
- **`npm run build` now goes through `scripts/build.mjs`.** Turbopack is native-only and
  has no WebAssembly build, so on this host the build must pass `--webpack`. That flag is
  opt-in via `NEXT_BUILD_WEBPACK=1` rather than applied everywhere, so a developer's
  machine, CI and the Docker image keep Turbopack. **Be aware this host builds with a
  different bundler from the one CI verifies** - it is the first place to look if a
  bundler-shaped problem ever appears.
- **`outputFileTracingExcludes` added.** `src/lib/storage/index.ts` builds an upload path
  from a runtime value, and its `turbopackIgnore` comments only speak to Turbopack. On
  the webpack path nothing suppresses the file tracer, and it starts copying `.agents/`,
  `brandkit/`, `reference/` and the rest into the deployed server - 743 files that will
  never be read. The excludes stop it.

> On Windows this last one still prints `⚠ Failed to copy traced files ... EPERM`.
> That is a local quirk: Next passes the exclude patterns to picomatch as an array, and
> the array form does not match Windows backslash paths. Verified that the same patterns
> do match POSIX paths, which is what runs on Hostinger. Ignore it locally.

**Step 1.** Commit and push, from your PC. Note `next.config.ts` is deleted and
`next.config.mjs` replaces it, so `git add` both:

```powershell
git add package.json package-lock.json next.config.ts next.config.mjs scripts/ tests/next-config.test.ts AGENTS.md docs/
```

```powershell
git commit -m "Build on a host whose glibc cannot load Next's native compiler"
```

```powershell
git push origin main
```

### 1.3 Hostinger build settings

**Step 2.** In hPanel → your app → **Settings and redeploy**, confirm these. Your
screenshot already had four of the five right:

| Field            | Value           | Note                                             |
| ---------------- | --------------- | ------------------------------------------------ |
| Framework preset | `Next.js`       | Correct                                          |
| Branch           | `main`          | Correct                                          |
| Node version     | `22.x`          | Correct - `package.json` requires `>=22`         |
| Root directory   | `./`            | Correct                                          |
| Build command    | `npm run build` | Correct, and now it does the standalone copy too |
| Package manager  | `npm`           | Correct                                          |
| Output directory | `.next`         | Correct                                          |

**There is nothing to change here.** The build command staying `npm run build` is why
1.2 folded the copy step into it.

### 1.4 Environment variables

**Step 3.** Same page → **Environment Variables** → **Add**, one at a time. The build
needs these, not just the running app: `next build` imports every route module, which
pulls in `@/lib/env`, which validates the lot before the build can finish.

| Variable             | Value                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `APP_ENV`            | `production`                                                                                         |
| `APP_URL`            | `https://ceyloncollection.qa`                                                                        |
| `BETTER_AUTH_URL`    | `https://ceyloncollection.qa`                                                                        |
| `APP_TIMEZONE`       | `Asia/Qatar`                                                                                         |
| `DATABASE_URL`       | `postgresql://ceylon_app:<db password>@db.ceyloncollection.qa:6432/ceyloncollection?sslmode=require` |
| `REDIS_URL`          | `rediss://default:<redis password>@cache.ceyloncollection.qa:6380`                                   |
| `DISABLE_REDIS`      | `false`                                                                                              |
| `BETTER_AUTH_SECRET` | a fresh 32+ character secret, **different from your local one**                                      |
| `N8N_WEBHOOK_SECRET` | a fresh 32+ character secret                                                                         |
| `STORAGE_DRIVER`     | `local`                                                                                              |
| `STORAGE_LOCAL_DIR`  | `/home/u475358938/domains/ceyloncollection.qa/uploads`                                               |
| `LOG_LEVEL`          | `info`                                                                                               |
| `HUSKY`              | `0`                                                                                                  |
| `NEXT_BUILD_WEBPACK` | `1`                                                                                                  |

Generate each secret separately, on your PC:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Decide the two database passwords now and write them down - Phases 2 and 3 set the same
values on the VPS.

Four of these bite if you get them wrong:

- **`rediss://` has two s's.** One `s` is plain TCP, which Phase 3 makes Redis refuse.
  The app starts anyway and logs `redis connection error` forever, because a Redis outage
  is designed to degrade the app rather than stop it - so this failure is quiet. Phase 6
  step 4 checks it deliberately.
- **`STORAGE_LOCAL_DIR` must be absolute**, and outside the app folder. See Phase 0.
- **`APP_ENV=production` forces `https://`** on both URLs. If the app logs a validation
  error about that, the certificate is not ready - wait, do not "fix" it with `http://`.
- **`HUSKY=0`** stops the `prepare` script trying to install git hooks during install.

**Step 4.** Click **Save and redeploy**, and watch the log.

### 1.5 What a good build looks like

Expect to still see this, and ignore it:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'lint-staged@17.3.0',
npm warn EBADENGINE   required: { node: '>=22.22.1' },
npm warn EBADENGINE   current: { node: 'v22.18.0' }
```

A warning, not an error. `lint-staged` runs on your PC before a commit and is never
loaded by the server. Hostinger's `22.x` is 22.18.0 today and will pass 22.22.1 in time.

The build should end with Next's route list and then:

```
copied .next/static -> .next/standalone/.next/static
copied public -> .next/standalone/public
standalone output ready
```

Those last three lines are `scripts/prepare-standalone.mjs`. **If they are missing, the
site will load with no styling** - check the Build command is `npm run build` and that
the push from Step 1 actually arrived.

The app will start and then fail to reach the database. That is expected - Phase 2 is
next. **Phase 1 is done when the build is green.**

> **Confirmed working, 2026-08-28.** The open worry with this route was whether Next's
> WebAssembly compiler would finish inside Hostinger's 15-minute per-phase build limit,
> since a native Turbopack build of this app takes 17 seconds. It does. The public site
> came up over HTTPS with fonts, CSS and images all serving, which also proves
> `scripts/prepare-standalone.mjs` ran - an unstyled page is the symptom when it has not.

---

## Phase 2 - PostgreSQL on the VPS

Your DNS is already right: `db.ceyloncollection.qa` and `cache.ceyloncollection.qa`
point at the VPS (`169.58.73.97`), and `@` plus `www` point at Hostinger. Those two
subdomains exist so each service can hold a **real Let's Encrypt certificate** - with a
trusted certificate, `postgres` and `ioredis` verify it against the system CA store with
no code changes and no `rejectUnauthorized: false`.

All of this phase happens over SSH on the VPS.

### 2.1 Get certificates for both hostnames

**If the VPS already runs this repo's Caddy container**, let Caddy do it. Add to
`docker/Caddyfile`:

```caddyfile
db.ceyloncollection.qa, cache.ceyloncollection.qa {
	respond "" 404
}
```

Reload Caddy. It obtains and renews both automatically, storing them in the `caddy_data`
volume under
`/data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/<hostname>/`. Mount that
volume read-only into the `db` and `cache` containers.

**If it does not**, use certbot (port 80 must be free while it runs):

```bash
sudo certbot certonly --standalone -d db.ceyloncollection.qa -d cache.ceyloncollection.qa
```

Certificates land in `/etc/letsencrypt/live/db.ceyloncollection.qa/`.

> **Renewal.** These last 90 days. PostgreSQL reloads one with
> `SELECT pg_reload_conf();`, Redis with `CONFIG SET tls-cert-file <path>`, and both are
> happy with a container restart. Add one to your renewal hook now, or the site breaks
> silently in three months.

### 2.2 Create the role and database

```sql
CREATE ROLE ceylon_app LOGIN PASSWORD '<the db password from Phase 1.4>';
CREATE DATABASE ceyloncollection OWNER ceylon_app;
```

### 2.3 Turn on TLS and publish the port

For the official Docker image:

```yaml
db:
  image: postgres:17
  command: >
    postgres
    -c ssl=on
    -c ssl_cert_file=/certs/server.crt
    -c ssl_key_file=/certs/server.key
  environment:
    POSTGRES_HOST_AUTH_METHOD: scram-sha-256
  volumes:
    - ./certs:/certs:ro
  ports:
    # Deliberately not 5432 - it removes you from every scanner sweeping the
    # default port. That is obscurity, not security, and it is free.
    - '6432:5432'
```

The key file must be mode `600` and owned by uid `999` (postgres inside the image) or the
server refuses to start:

```bash
sudo chown 999:999 certs/server.key certs/server.crt
sudo chmod 600 certs/server.key
```

### 2.4 Prove TLS is on before opening the firewall

```bash
psql "postgresql://ceylon_app@127.0.0.1:6432/ceyloncollection?sslmode=require" -c "SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid();"
```

`t` means encrypted. `f` means the `ssl=on` flags are not taking effect - fix that first.

**Phase 2 is done when that query returns `t`.**

---

## Phase 3 - Redis on the VPS

Redis has no users by default and its default configuration will talk to anyone. Run it
with the plain port switched off entirely.

### 3.1 Start it with TLS and a password

```yaml
cache:
  image: redis:7
  command: >
    redis-server
    --port 0
    --tls-port 6380
    --tls-cert-file /certs/server.crt
    --tls-key-file /certs/server.key
    --tls-ca-cert-file /certs/server.crt
    --tls-auth-clients no
    --requirepass "<the redis password from Phase 1.4>"
    --appendonly yes
  volumes:
    - ./certs:/certs:ro
    - cache_data:/data
  ports:
    - '6380:6380'
```

`--port 0` is the important line: without it Redis keeps listening unencrypted on 6379
and one wrong firewall rule exposes it. `--tls-auth-clients no` means the _client_ does
not present a certificate; the server still presents its own, and the password is the
credential.

### 3.2 Open the firewall

```bash
sudo ufw allow 6432/tcp comment 'postgres for hostinger app'
sudo ufw allow 6380/tcp comment 'redis for hostinger app'
sudo ufw enable
```

Hostinger's Node.js apps do not publish a fixed outbound IP, so you cannot narrow these
the way you would want to. **Ask Hostinger support whether your plan has a stable egress
IP or range** - ask about upload persistence (Phase 0) in the same message. If it does,
replace these with `ufw allow from <that range> to any port 6432` and the equivalent for
Redis; that one change is worth more than everything else here.

Install `fail2ban` and confirm SSH is key-only. Two internet-facing database ports raise
the value of getting the rest of the host right.

**Phase 3 is done when `redis-cli --tls --insecure -h 127.0.0.1 -p 6380 -a '<password>' ping`
returns `PONG`.**

---

## Phase 4 - Create the schema

Migrations do not run on Hostinger. Run them from your PC, pointed at the VPS.

`scripts/load-env.mts` loads `.env.local` with `override: false`, so a variable set in
the shell wins - which is what makes this safe without editing any file.

In PowerShell, from the repo root:

```powershell
$env:DATABASE_URL = "postgresql://ceylon_app:<db password>@db.ceyloncollection.qa:6432/ceyloncollection?sslmode=require"
npm run db:migrate
npm run db:seed
npm run auth:create-owner
```

- `db:migrate` says how many migrations it applied. Expect a number now, and
  `Nothing to apply` on later runs.
- `db:seed` loads the 389 taxonomy values.
- `auth:create-owner` creates your first sign-in, interactively.

Then clear the variable so you cannot later run `npm run db:demo` against production by
accident:

```powershell
Remove-Item Env:DATABASE_URL
```

> `?sslmode=require` is understood by `postgres.js`, which maps `sslmode` to `ssl` when
> parsing the URL. It encrypts the connection but does **not** verify the certificate
> chain, so it defends against passive sniffing rather than an active
> man-in-the-middle. `verify-full` would need the CA bundle passed as a driver option -
> a code change in `src/db/client.ts`.

**Phase 4 is done when `db:migrate` says `Nothing to apply` on a second run.**

---

## Phase 5 - Domain and SSL

Your DNS is already set: `@` → `145.14.153.26` (Hostinger), `www` → CNAME
`ceyloncollection.qa`, `db` and `cache` → `169.58.73.97` (the VPS).

Two things left:

1. **Wait for SSL.** Hostinger issues it automatically once the domain resolves to them.
   Until it exists, the app refuses to boot - `APP_ENV=production` requires `https://`,
   because session cookies are `Secure`-only and would never be sent over plain HTTP.
   That error in the log means "not ready yet", not "misconfigured".
2. **Check propagation** before assuming anything is broken. A `.qa` ccTLD can take
   anything from minutes to 24 hours:
   ```bash
   nslookup ceyloncollection.qa
   nslookup db.ceyloncollection.qa
   ```

> If you ever move the nameservers to Hostinger, **re-create the `db` and `cache`
> records there** or the app loses its database.

**Phase 5 is done when `https://ceyloncollection.qa` shows a padlock.**

---

## Phase 6 - Verify

Do not stop at "the page loaded". Four of these six can pass invisibly.

**1. The build.** In the deployment log, confirm the three `copied ... / standalone
output ready` lines from Phase 1.5.

**2. Boot.** In the runtime log, find `"msg":"server starting"` and no environment
validation error. A validation failure names the exact variable.

**3. The public site.** Open `https://ceyloncollection.qa`. Padlock, and the page has its
fonts and layout. Unstyled text means the standalone copy did not happen.

**4. Redis - the one that fails silently.** The app runs fine without it, on a per-process
in-memory fallback that makes rate limiting useless. Two ways to prove it is connected:

- Search the runtime log for `redis connected`, logged at `info`. Its absence, or any
  `redis connection error`, means the fallback is in use.
- On the VPS, watch commands arrive while you click around the site:
  ```bash
  redis-cli --tls --insecure -h 127.0.0.1 -p 6380 -a '<password>' monitor
  ```

**5. The database.** Sign in at `https://ceyloncollection.qa/login` with the owner account
from Phase 4, complete two-factor, and open `/admin/taxonomy`. Seeded values there prove
the app is reading the VPS database over TLS.

**6. Whether uploads survive a deploy.** The open question from Phase 0, and the only way
to answer it is to try. Upload a photo to a lead and confirm it renders. Push a trivial
commit to `main`. When the redeploy finishes, reload that photo.

- Renders → local storage holds. Write that in this file.
- 404 → it does not. Photo upload is a demo feature until `s3Storage` is implemented.
  Write that in this file too, so nobody runs this test twice.

**7. n8n.** Point the n8n credential at `https://ceyloncollection.qa/n8n/intake` using
HMAC signing, send one test message, and confirm it appears at `/admin/intake`.

---

## Phase 7 - Day to day

**Deploying** is `git push origin main`. Hostinger pulls, installs, runs `npm run build`,
and restarts.

**Migrations are still manual**, exactly as in Phase 4. If a release adds one, run
`npm run db:migrate` **before** pushing the code that needs it - new code against an old
schema errors on every request, while old code against a new schema is almost always
fine.

**Rolling back** means reverting the commit and pushing; the deploy tracks the branch.
Hostinger has no per-commit rollback.

**Backups are yours now.** The `backup` container in `docker/compose.prod.yml` only runs
if you run that stack. If PostgreSQL on the VPS is standalone, set up a nightly
`pg_dump -Fc` and then run the restore drill in
[DEPLOYMENT.md](DEPLOYMENT.md). A backup nobody has restored is a hope, not a backup.

---

## Known gaps with this setup

| Gap                                  | Consequence                                                | Fix                                                         |
| ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Upload persistence unverified        | Lead photos may vanish on deploy - test it, Phase 6 step 6 | Implement `s3Storage` in `src/lib/storage/index.ts`         |
| `sslmode=require`, not `verify-full` | Encrypted, but not proof against an active MITM            | Pass a CA bundle in `src/db/client.ts`                      |
| Firewall open to the whole internet  | Both database ports are reachable by anyone                | Allowlist Hostinger's egress range, if support confirms one |
| `/n8n/intake` publicly reachable     | Only the HMAC check stands between the internet and intake | Use HMAC, never the bearer fallback; keep the rate limit    |
| Migrations run from a laptop         | A deploy can land before its schema                        | Run `db:migrate` before pushing, every time                 |
| App sleeps when idle                 | First request after a quiet spell is slow                  | Nothing to fix; know it before calling it a bug             |
