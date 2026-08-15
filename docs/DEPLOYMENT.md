# Deployment

How the production stack fits together, how to deploy and update it, and how to prove
the backups actually work. For what the pieces _are_ and why, see
[CONCEPTS.md](CONCEPTS.md). For local development, see [LOCAL-DEV.md](LOCAL-DEV.md).

## The stack

Five containers, defined in [`docker/compose.prod.yml`](../docker/compose.prod.yml):

| Service  | What                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| `app`    | The Next.js server, built from [`Dockerfile`](../Dockerfile)'s `runner` stage |
| `db`     | PostgreSQL 17, one named volume                                               |
| `cache`  | Redis, password-protected, one named volume                                   |
| `proxy`  | Caddy - terminates TLS, gets a Let's Encrypt certificate automatically        |
| `backup` | Nightly `pg_dump`, see [Backups](#backups) below                              |

A sixth, `migrate`, exists but is not part of the running stack - see
[Migrations](#migrations).

**n8n is not here.** The owner runs it separately on the same VPS and reaches `app`
over the `ceyloncollection_internal` Docker network by container name
(`http://app:3000/n8n/intake`), the way [LOCAL-DEV.md](LOCAL-DEV.md#pointing-n8n-at-it)
describes. Only `proxy` publishes a port to the host; everything else, including `app`
itself, is reachable only from inside that network. Attach n8n's own compose file to it
with:

```yaml
networks:
  ceyloncollection_internal:
    external: true
```

**`/n8n/*` is never reachable from the public internet.** `docker/Caddyfile` returns
404 for it before the catch-all proxy rule runs. This is deliberate, not an oversight -
see [LOCAL-DEV.md](LOCAL-DEV.md#pointing-n8n-at-it).

## First deploy

1. Point the domain's DNS `A` record at the VPS before doing anything else - Caddy's
   automatic TLS needs to complete an HTTP challenge against it, which fails silently
   if the domain does not resolve yet.
2. On the VPS: `git clone` this repo (or just copy `docker/`, `Dockerfile`, and
   `scripts/backup-db.sh` - the running containers never need the rest of the source,
   since they pull built images from GHCR).
3. `cp docker/.env.production.example .env.production` at the repo root, and fill in
   every value. Generate the two secrets with the command the file itself shows.
4. Log in to GHCR so Docker can pull the private image:
   ```bash
   echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin
   ```
   A classic personal access token with `read:packages` scope works, or a fine-grained
   token scoped to this repo.
5. Pull the images and create the database schema, in that order - the app will crash
   loop if it starts against a database with no tables yet:
   ```bash
   docker compose --env-file .env.production -f docker/compose.prod.yml pull
   docker compose --env-file .env.production -f docker/compose.prod.yml \
     --profile tools run --rm migrate
   docker compose --env-file .env.production -f docker/compose.prod.yml up -d
   ```
6. `docker compose -f docker/compose.prod.yml logs -f app` and confirm you see
   `"msg":"server starting"` with no validation errors. Visit the domain.
7. Create the first account the same way local dev does, just inside the container:
   ```bash
   docker compose -f docker/compose.prod.yml exec app node_modules/.bin/tsx \
     --conditions=react-server scripts/create-owner.mts
   ```
   `db:seed` for the taxonomy lists works the same way, substituting
   `scripts/seed.mts`.

## Updating

GitHub Actions builds and pushes `ghcr.io/udithahashi/ceyloncollection:latest` (and
`:<git sha>`) on every push to `main` that passes Verify - see the `publish` job in
[`ci.yml`](../.github/workflows/ci.yml). A deploy is then:

```bash
docker compose --env-file .env.production -f docker/compose.prod.yml pull
# Only if this release includes a migration:
docker compose --env-file .env.production -f docker/compose.prod.yml \
  --profile tools run --rm migrate
docker compose --env-file .env.production -f docker/compose.prod.yml up -d
```

`up -d` recreates only the containers whose image actually changed, so `db`, `cache`,
`proxy` and `backup` are left running.

Pin `IMAGE_TAG` in `.env.production` to a specific `<git sha>` instead of `latest` if
you want deploys to be an explicit, reviewable step rather than "whatever main is
today" - both tags are published for exactly this reason.

## Migrations

`migrate` is a separate Compose service, gated behind `--profile tools` specifically so
`docker compose up` can never start it by accident - migrations are something you run
once, deliberately, before the app that depends on them starts, not a background
process. It runs the identical `npm run db:migrate` script local dev uses (see the
comment in `scripts/migrate.mts` for why that matters), against a full copy of the
source and `node_modules` rather than the slim runtime image - see the Dockerfile's own
comment on the `migrator` stage for why a partial `node_modules` copy was rejected.

## Backups

`backup` runs `scripts/backup-db.sh` nightly (`BACKUP_INTERVAL_SECONDS`, default 86400) inside a `postgres:17` container, so `pg_dump`'s version always matches the
server it is dumping. Each run writes a timestamped `-Fc` (custom format, compressed)
dump to the `backups` named volume, then deletes anything older than
`BACKUP_RETENTION_DAYS` (default 14). Watch it work:

```bash
docker compose -f docker/compose.prod.yml logs -f backup
```

**Get a dump off the VPS regularly.** The `backups` volume protects against a bad
migration or an accidental `DELETE`; it does nothing if the VPS itself is lost. A
simple cron `docker cp`-ing the newest file to somewhere else (a laptop, object
storage) is enough for this size of business - nothing in this repo automates that
part yet, on purpose, since it is a one-line decision the owner should make rather than
one baked in silently.

### The restore drill

**A backup nobody has restored is a hope, not a backup.** Run this once after the first
deploy, and again after anything changes about how backups are taken - not because it
is expected to fail, but because "we assumed it would work" is exactly how a real
restore goes wrong at the worst possible time.

1. List what is available:
   ```bash
   docker compose -f docker/compose.prod.yml exec backup \
     ls -la /backups
   ```
2. Spin up a throwaway PostgreSQL container - never restore into `db` directly for a
   drill, or a mistake here costs the real database:
   ```bash
   docker run -d --name restore-drill --network ceyloncollection_internal \
     -e POSTGRES_USER=ceylon -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill \
     postgres:17
   ```
3. Copy the newest dump in and restore it:
   ```bash
   docker cp "$(docker compose -f docker/compose.prod.yml exec backup \
     sh -c 'ls -t /backups/*.dump | head -1')" ./drill.dump
   docker cp ./drill.dump restore-drill:/drill.dump
   docker exec -e PGPASSWORD=drill restore-drill \
     pg_restore -U ceylon -d drill --no-owner /drill.dump
   ```
4. Prove the data is actually there, not just that the command exited 0:
   ```bash
   docker exec -e PGPASSWORD=drill restore-drill \
     psql -U ceylon -d drill -c "select count(*) from leads;"
   ```
   The count should be plausible for how many leads exist right now - zero, or an
   error, means the drill failed and the backup needs investigating _before_ it is
   ever actually needed.
5. Clean up:
   ```bash
   docker rm -f restore-drill && rm -f drill.dump
   ```

Restoring into the real `db` service during an actual incident is the same
`pg_restore` command, pointed at `db` instead of a throwaway container, after stopping
`app` so nothing writes during the restore.

## sharp and native modules

`sharp` (image re-encoding for lead photos) ships a different native binary per
platform. The Dockerfile never copies a host `node_modules` in - every stage that
installs dependencies runs `npm ci` inside the Linux build, so npm always fetches the
Linux binary. `next.config.ts` also forces `sharp`'s files into the standalone output
trace explicitly (`outputFileTracingIncludes`); Next's own docs list sharp as the
example of a native module the automatic tracer can miss. Both were verified by
actually building the image and running it - see the git history on this file's
introduction if either is ever in doubt.

## Storage volume

Lead photos live under `STORAGE_LOCAL_DIR` (`/app/storage/uploads` inside the
container), mounted as the named volume `uploads` - never a host bind mount to a path
someone forgot to create. The Dockerfile creates and `chown`s that directory to the
non-root `nextjs` user before the volume is ever attached, because Docker seeds a fresh
named volume's ownership from whatever the image already has at that path. `npm run
doctor` checks this directory is writable in local dev; the equivalent failure in
production is the app logging permission errors on every photo upload.
