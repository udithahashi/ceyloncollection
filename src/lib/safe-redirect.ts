/**
 * Validating a redirect target that came from a query string.
 *
 * The login page carries a `?next=` parameter so that following a bookmark to a
 * deep page lands you back there after signing in. That parameter is attacker
 * controlled: a link to
 *
 *   https://our-app/login?next=https://evil.example/login
 *
 * would, if we redirected blindly, take a member of staff from our real domain to
 * a convincing fake one immediately after they signed in. Only same-site absolute
 * paths are allowed through.
 */

/**
 * Where to go when the requested target is missing or not allowed.
 *
 * The dashboard, not `/` - `/` is the public shop window, and signing in to the
 * back office only to be shown the marketing site would be a bug that looks
 * like a design decision.
 */
export const DEFAULT_REDIRECT = '/admin';

/**
 * Paths that are never a sensible destination, because landing on them after
 * sign-in would immediately bounce the user somewhere else.
 */
const NEVER_REDIRECT_TO = ['/login', '/two-factor', '/setup-two-factor', '/accept-invite'];

/**
 * Returns `target` if it is a safe same-site path, otherwise the default.
 *
 * @example
 * safeRedirect('/admin/leads/123')      // '/admin/leads/123'
 * safeRedirect('https://evil.test')     // '/admin'
 * safeRedirect('//evil.test')           // '/admin'
 */
export function safeRedirect(target: unknown, fallback = DEFAULT_REDIRECT): string {
  if (typeof target !== 'string' || target.length === 0) return fallback;

  // Control characters can be used to smuggle a second header or to confuse the
  // browser's URL parser, and have no business in a path.

  if (/[\u0000-\u001f\u007f]/.test(target)) return fallback;

  // Must be an absolute path on this origin.
  if (!target.startsWith('/')) return fallback;

  // `//evil.test` is protocol-relative: the browser reads it as another origin.
  // `/\evil.test` is the same trick, because some parsers treat a backslash as a
  // slash.
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback;

  // A path containing a scheme is malformed at best.
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(target)) return fallback;

  const path = target.split(/[?#]/)[0] ?? '';
  if (NEVER_REDIRECT_TO.some((blocked) => path === blocked || path.startsWith(`${blocked}/`))) {
    return fallback;
  }

  return target;
}
