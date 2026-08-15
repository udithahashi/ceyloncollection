/**
 * Runs before every page render.
 *
 * In Next.js 16 this file replaces `middleware.ts` and the exported function is
 * named `proxy`. It runs on the Node.js runtime.
 *
 * It does exactly two things, both cheap:
 *
 * 1. Issues a fresh CSP nonce and sets the Content-Security-Policy header.
 * 2. Sends anyone with no session cookie who asks for a back-office page
 *    straight to the login page, to save rendering a layout that is about to
 *    redirect anyway. The public site is left alone - see PROTECTED_PREFIXES.
 *
 * What it deliberately does NOT do is authorise anything. It never reads the
 * database and never decides whether a role may see a page. The Next.js
 * documentation is explicit that a Server Function is served as a POST to the
 * route it lives on, so a matcher change or a moved file can silently remove
 * proxy coverage from a mutation. Authentication and authorisation therefore live
 * in @/lib/auth/session, which runs inside the page or action itself. The check
 * here is a performance shortcut, and treating it as a security boundary is how
 * applications end up with an unguarded endpoint nobody noticed.
 */
import { NextResponse, type NextRequest } from 'next/server';

/**
 * The only paths this shortcut redirects.
 *
 * THIS LIST INVERTED WHEN THE PUBLIC SITE ARRIVED, AND THE REASONING MATTERS.
 * Until then every route in the application needed a session, so the proxy could
 * redirect anything not explicitly excused. Now `/` is a shop window that must
 * answer an anonymous visitor, and the back office is the exception rather than
 * the rule - so the gate names what it protects instead of what it lets through.
 *
 * This is safe to state so bluntly only because the redirect is a performance
 * shortcut and never the access check. `(back-office)/admin/layout.tsx` calls
 * `requireUser` and every page and action authorises itself - see the note at the
 * top of this file. If this list were the security boundary, inverting it would
 * be how an application accidentally publishes its admin panel.
 *
 * Exported so a test can assert it matches the routes that actually exist.
 */
export const PROTECTED_PREFIXES = ['/admin'];

/**
 * Paths reachable without a session, and expected to be.
 *
 * Now purely documentation and a test fixture: nothing here is protected by the
 * gate above, so no entry is load-bearing. It stays because "which pages are
 * meant to be anonymous" is worth stating somewhere a test can check, and
 * `proxy.test.ts` asserts each one is a real page under `(auth)`.
 */
export const PUBLIC_PATHS = ['/login', '/two-factor', '/accept-invitation'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * The session cookie's name. `cc` is the `cookiePrefix` configured in @/lib/auth;
 * Better Auth appends `.session_token`.
 *
 * Only the cookie's presence is checked, never its contents - validating a signed
 * token here would mean duplicating Better Auth's crypto in a second place, and
 * two implementations of one security check is one too many.
 */
const SESSION_COOKIE = 'cc.session_token';

export function proxy(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID();
  const isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * `strict-dynamic` lets a script that already passed the nonce check load
   * further scripts, which is how Next.js hydration works, while still blocking
   * anything injected into the HTML.
   *
   * Two development-only relaxations, both required by React's dev build and
   * neither present in production:
   * - `unsafe-eval`, used to rebuild server error stacks in the browser.
   * - `unsafe-inline` for styles, because Turbopack injects stylesheets inline
   *   while hot-reloading.
   */
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // `blob:` and `data:` are needed for image previews before an upload is saved.
    "img-src 'self' blob: data:",
    // Fonts are self-hosted by next/font, so no external font origin is allowed.
    "font-src 'self'",
    // Server Actions post back to this origin; nothing else should be contacted.
    `connect-src 'self'${isDevelopment ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    // Stops a form on our page being repointed at an attacker's server.
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (!isDevelopment) policy.push('upgrade-insecure-requests');

  const contentSecurityPolicy = policy.join('; ');

  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie && isProtectedPath(pathname)) {
    const loginUrl = new URL('/login', request.url);
    // Only a path is carried across, and `safeRedirect` validates it again on the
    // way back out. A `next` value is attacker-controlled input.
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Next.js reads the nonce out of the request's CSP header and applies it to the
  // scripts it emits, so the header has to be set on the request as well as the
  // response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      /**
       * Everything except static assets and metadata files. Without the exclusions
       * the redirect above would apply to stylesheets and JavaScript, and the login
       * page would arrive unstyled.
       */
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml).*)',
      // Prefetches are skipped: a hovered link should not consume work, and a
      // prefetch redirected to /login would poison the router cache.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
