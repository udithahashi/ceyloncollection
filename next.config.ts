import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * The Content-Security-Policy is deliberately NOT here: it needs a fresh nonce
 * per request, so it is set in middleware once authentication lands in Phase 2.
 * Everything below is static and safe to send from the edge of the app.
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

  // pino ships its own transport machinery and must not be bundled.
  serverExternalPackages: ['pino', 'pino-pretty'],

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
