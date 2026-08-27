/**
 * WHY THIS IS `.mjs` AND NOT `.ts`.
 *
 * Next compiles a TypeScript config before reading it, and that compilation needs the
 * native SWC binary. The production host (Hostinger's Node.js Web Apps, CloudLinux 8)
 * has glibc 2.28; `@next/swc-linux-x64-gnu` requires 2.29, so the native binary refuses
 * to load and Next falls back to its WebAssembly compiler - which cannot do this
 * particular job. The failure is opaque and names a file nobody wrote:
 *
 *   ⨯ Failed to load next.config.ts
 *   Error: Cannot find module '.../6a90bda0b22e0.next.config'
 *
 * A `.mjs` config skips that compilation step entirely: Node imports it directly.
 * See docs/DEPLOY-HOSTINGER.md, Phase 1.
 *
 * The cost is that this file can no longer import from `src/`, which is TypeScript.
 * There is exactly one such import, and `tests/next-config.test.ts` guards it.
 */

/**
 * Security headers applied to every response.
 *
 * The Content-Security-Policy is deliberately NOT here: it needs a fresh nonce
 * per request, so it is set in src/proxy.ts. Everything below is static and safe
 * to send from the edge of the app.
 */
const securityHeaders = [
  // Force HTTPS for two years, including subdomains. Ignored by browsers over
  // plain HTTP, so this is harmless in local development.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Never let a browser guess a response's type - the main defence against a
  // file uploaded as an image being interpreted as script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // This app must never be framed; there is no legitimate embedding use case,
  // and disallowing it removes clickjacking entirely.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Send the full URL only to our own origin, and just the origin elsewhere, so
  // internal admin URLs containing record ids never leak to third parties.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deny hardware and location access by default. Camera is re-enabled per-route
  // later, where the lead image uploader legitimately needs it.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Isolate this browsing context from other origins.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

/**
 * `MAX_UPLOAD_TOTAL_BYTES` from `src/lib/images/limits.ts`, restated.
 *
 * That module exists precisely so this number is not written down twice, and this file
 * used to import it. The `.mjs` conversion above took that ability away - a `.mjs` file
 * cannot import a `.ts` one at runtime.
 *
 * So it is duplicated, and the duplication is guarded rather than trusted:
 * `tests/next-config.test.ts` imports both and fails if they ever disagree. That is the
 * same approach the theme tokens use against `globals.css` - a number in two places is
 * fine as long as a test is watching, and fatal as soon as one is not.
 */
const MAX_UPLOAD_TOTAL_BYTES = 40 * 1024 * 1024;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Do not advertise the framework and version to attackers scanning for known
  // vulnerabilities.
  poweredByHeader: false,

  // Produces a minimal self-contained server bundle for the production Docker
  // image, instead of requiring the full node_modules tree on the server.
  output: 'standalone',

  // pino ships its own transport machinery and must not be bundled. sharp is a native
  // module, and bundling it breaks the .node binary lookup.
  serverExternalPackages: ['pino', 'pino-pretty', 'sharp'],

  // The `output: 'standalone'` file tracer sometimes misses a native module's
  // platform-specific .node binaries, and sharp is Next's own documented example of
  // this. Without this, the production Docker image can build and boot successfully
  // and still 500 the moment a photo is uploaded, because the traced output looks
  // complete but the binary sharp actually loads at runtime is missing.
  outputFileTracingIncludes: {
    '/**': ['node_modules/sharp/**/*'],
  },

  /**
   * Directories the standalone output must never absorb.
   *
   * `src/lib/storage/index.ts` builds an upload path from a runtime value, and a bundler
   * that cannot resolve such a path conservatively assumes the whole project might be
   * needed. Its `turbopackIgnore` comments say "do not trace this" - and they only speak
   * to Turbopack. On the webpack path this build uses when the native binary will not
   * load (see the top of this file and scripts/build.mjs), nothing suppresses it, and
   * the tracer starts copying tool installs and design source into the deployed server.
   *
   * It announces itself on Windows, where copying a symlinked skill directory fails
   * outright:
   *
   *   ⚠ Failed to copy traced files for .../lead-images/[id]/[variant]/route.js
   *     EPERM: operation not permitted, copyfile '.agents/skills/animate' -> ...
   *
   * On Linux the same copy succeeds, which is worse: nothing warns, and the deployment
   * quietly carries hundreds of files it will never read. None of these directories is a
   * runtime input, so excluding them costs nothing and is true regardless of bundler.
   */
  outputFileTracingExcludes: {
    '/**': [
      '.agents/**/*',
      '.claude/**/*',
      '.codex/**/*',
      '.github/**/*',
      'VibeSec-Skill/**/*',
      'brandkit/**/*',
      'docs/**/*',
      'reference/**/*',
      // Uploaded photos live here in local development. They are data the running app
      // writes, never something it needs a copy of at build time.
      'storage/**/*',
    ],
  },

  images: {
    /**
     * Next 16 changed the default here to `[75]` - a `quality` prop asking for
     * anything else is not clamped to the nearest allowed value, it is silently
     * refused and the request falls back to 75 with no error and no build
     * warning. That is exactly the kind of change AGENTS.md warns training data
     * would get wrong. It surfaced on the public hero photo: it ships as an
     * already-compressed WebP, and re-encoding a lossy file a second time at 75
     * is a second, visible compression pass on top of a deliberate first one.
     * `quality={95}` on that `<Image>` did nothing until this list included 95.
     * 100 is included too, for anything that should not be recompressed at all.
     */
    qualities: [75, 90, 95, 100],
  },

  experimental: {
    serverActions: {
      /**
       * Server Action bodies are capped at 1MB by default, which is the right default
       * and the wrong one for the photo uploader: a single phone picture exceeds it.
       *
       * The number comes from the constant above so that the framework's limit and the
       * application's cannot drift. If they did, the failure would be a rejection
       * before any of our code runs, with a message about bytes rather than about
       * photos, and the uploader's own friendly warning would never be reached.
       */
      // In bytes, rather than the "40mb" string form, so it is the same number the
      // uploader checks against rather than a rounded restatement of it.
      bodySizeLimit: MAX_UPLOAD_TOTAL_BYTES,
    },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
