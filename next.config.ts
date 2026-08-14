import type { NextConfig } from 'next';

import { MAX_UPLOAD_TOTAL_BYTES } from './src/lib/images/limits';

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

const nextConfig: NextConfig = {
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

  experimental: {
    serverActions: {
      /**
       * Server Action bodies are capped at 1MB by default, which is the right default
       * and the wrong one for the photo uploader: a single phone picture exceeds it.
       *
       * The number comes from @/lib/images/limits so that the framework's limit and the
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
