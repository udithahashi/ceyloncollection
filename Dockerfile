# Multi-stage build for the production image.
#
# Two things this file exists to get right, both documented as traps in
# docs/HANDOVER.md:
#
# 1. `sharp` is a native module. It must never be copied in from a host
#    node_modules (Windows binaries do not run on Linux) - every stage below
#    that touches node_modules runs `npm ci` inside THIS image, on Linux, so
#    npm downloads the correct prebuilt binary itself.
# 2. `next build` imports every Route Handler's module to read its runtime
#    config, which pulls in `@/lib/env` - the same reason CI's Build step needs
#    env vars even though nothing it builds talks to a real database. The
#    builder stage below sets the identical throwaway values .github/workflows/
#    ci.yml uses, for the same reason.
#
# Two build targets come out of this file:
#   `runner`   (the default - last stage wins) - the small image that actually
#              serves the app, built from `next build`'s standalone output.
#   `migrator` - reuses the builder stage's full node_modules and source to run
#              `npm run db:migrate` as a one-off container. It is deliberately
#              not the default target; nobody should `docker run` it by
#              accident. See docker/compose.prod.yml and docs/DEPLOYMENT.md.

FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
# --ignore-scripts: this project has no postinstall step of its own, and
# skipping other packages' install scripts keeps an image build from silently
# running arbitrary code pulled from the registry. `npm rebuild sharp` below
# re-runs exactly the one script this app actually needs (sharp's own binary
# download), nothing more.
RUN npm ci --ignore-scripts && npm rebuild sharp

# ---------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Throwaway values of the right shape, not credentials - there is nothing for
# them to open. `next build` needs `@/lib/env` to validate successfully, not
# to connect to anything real; the app reads its actual production
# configuration from the container environment at runtime, set in
# docker/compose.prod.yml, never baked into the image.
ENV APP_ENV=test \
  APP_URL=http://localhost:3000 \
  BETTER_AUTH_URL=http://localhost:3000 \
  DATABASE_URL=postgresql://build:build@127.0.0.1:1/build_no_database \
  DISABLE_REDIS=true \
  BETTER_AUTH_SECRET=docker-build-only-not-a-real-secret-000000000000 \
  N8N_WEBHOOK_SECRET=docker-build-only-not-a-real-secret-000000000000 \
  NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# One-off migration runner. Shares the builder stage's full node_modules
# (tsx, dotenv, drizzle-orm, postgres) rather than hand-picking a partial
# node_modules into the slim runtime image, which is the fragile way to do
# this - tsx alone drags in esbuild and other packages that are easy to miss.
FROM builder AS migrator

CMD ["npm", "run", "db:migrate"]

# ---------------------------------------------------------------------------
# The image that actually serves traffic. Deliberately the LAST stage, so a
# plain `docker build .` with no --target produces this, not the migrator.
FROM base AS runner

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  # STORAGE_LOCAL_DIR's default. Created and owned by the runtime user before
  # a volume is ever mounted here: Docker seeds a fresh named volume's
  # ownership from whatever the image already has at that path, which is what
  # keeps `npm run doctor`'s writability check passing instead of failing on a
  # root-owned mount - see docs/HANDOVER.md's storage-volume trap.
  && mkdir -p /app/storage/uploads \
  && chown -R nextjs:nodejs /app/storage/uploads

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# No curl/wget in a slim image on purpose - Node 22 has fetch built in, so the
# healthcheck costs nothing extra in the image. Targets /login rather than a
# new /api/health route: AGENTS.md only allows two browser-facing REST
# exceptions, both for reasons that don't apply here, and /login is already a
# real, public, unauthenticated page that proves the Node process is up and
# serving - a container healthcheck needs liveness, not a dependency probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/login').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
