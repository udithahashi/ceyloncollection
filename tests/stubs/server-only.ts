/**
 * A no-op stand-in for the `server-only` package.
 *
 * `@/lib/env` imports `server-only` so that a client component importing it fails the
 * build instead of failing in the browser. The real package throws unless the importer
 * resolved it under React's `react-server` condition, which Next sets and a plain Node
 * process does not - so under Vitest every test that touches configuration would die
 * with a message about Client Components, which is exactly the confusion the guard was
 * added to remove.
 *
 * Tests run on the server by definition. Vitest aliases the package to this file (see
 * `vitest.config.mts`); the npm scripts that run under `tsx` pass
 * `--conditions=react-server` for the same reason.
 */
export {};
