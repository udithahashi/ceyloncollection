/**
 * Tests for the proxy's session gate.
 *
 * The lists are written by hand and the routes they name live somewhere else
 * entirely, so the two drift apart the moment a page is renamed. When they drift
 * the symptom is a page that redirects to the login form for no visible reason -
 * which reads as a session bug and costs an hour before anyone suspects a string
 * literal.
 *
 * Since the public site arrived the gate protects `/admin` rather than excusing a
 * handful of pages, so the expensive mistake has a second shape: a back-office
 * route that ends up outside the prefix and quietly stops being redirected. That
 * one is not a security hole - every page authorises itself - but it is worth a
 * test, because "the shortcut silently stopped applying" is invisible otherwise.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { PROTECTED_PREFIXES, PUBLIC_PATHS, proxy } from './proxy';

const APP = join(process.cwd(), 'src', 'app');
const AUTH_GROUP = join(APP, '(back-office)', '(auth)');

/** Where the proxy sent this request, or null if it passed through. */
function redirectTarget(path: string, { withSession = false } = {}): string | null {
  const request = new NextRequest(`http://localhost:3000${path}`);
  if (withSession) request.cookies.set('cc.session_token', 'irrelevant-value');

  const location = proxy(request).headers.get('location');
  return location === null ? null : new URL(location).pathname;
}

describe('PUBLIC_PATHS', () => {
  it.each(PUBLIC_PATHS)('%s is a route that exists', (path) => {
    expect(existsSync(join(AUTH_GROUP, path.slice(1), 'page.tsx')), `${path} has no page`).toBe(
      true
    );
  });

  it('lists absolute paths only', () => {
    for (const path of PUBLIC_PATHS) {
      expect(path.startsWith('/'), `${path} must start with a slash`).toBe(true);
      expect(path.endsWith('/'), `${path} must not end with a slash`).toBe(false);
    }
  });
});

describe('PROTECTED_PREFIXES', () => {
  it.each(PROTECTED_PREFIXES)('%s is a route segment that exists', (prefix) => {
    // The back office lives under a route group, which contributes no URL
    // segment - so the prefix has to be found inside it, not at the app root.
    expect(existsSync(join(APP, '(back-office)', prefix.slice(1))), `${prefix} has no folder`).toBe(
      true
    );
  });

  it('does not cover the public site', () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(prefix, 'the whole site must not be behind the gate').not.toBe('/');
    }
  });
});

describe('the session gate', () => {
  it('sends an anonymous visitor from a back-office page to the login form', () => {
    expect(redirectTarget('/admin')).toBe('/login');
    expect(redirectTarget('/admin/leads')).toBe('/login');
    expect(redirectTarget('/admin/leads/CC-2026-0001')).toBe('/login');
  });

  it('remembers where they were going', () => {
    const request = new NextRequest('http://localhost:3000/admin/leads?status=new');
    const location = proxy(request).headers.get('location');

    expect(new URL(location ?? '').searchParams.get('next')).toBe('/admin/leads?status=new');
  });

  it('lets an anonymous visitor read the public site', () => {
    // The whole point of the inversion. If any of these ever redirect, the shop
    // window has been locked behind the staff door.
    expect(redirectTarget('/')).toBeNull();
    expect(redirectTarget('/collections')).toBeNull();
    expect(redirectTarget('/about')).toBeNull();
  });

  it('lets an anonymous visitor reach the sign-in flow', () => {
    for (const path of PUBLIC_PATHS) {
      expect(redirectTarget(path), `${path} must not redirect`).toBeNull();
    }
  });

  it('does not redirect a request that already has a session cookie', () => {
    expect(redirectTarget('/admin/leads', { withSession: true })).toBeNull();
  });

  it('does not mistake a lookalike path for a protected one', () => {
    // `/administration` starts with the same letters as `/admin`, and a naive
    // `startsWith` would gate it. It is not a back-office route.
    expect(redirectTarget('/administration')).toBeNull();
    expect(redirectTarget('/admin-enquiries')).toBeNull();
  });
});

describe('the n8n intake route', () => {
  it('is never redirected to the login page, even with no session cookie', () => {
    // n8n has no session cookie to send - it proves itself with an HMAC signature
    // inside the route. If the proxy ever redirected this, the webhook would receive
    // nothing but the login page's HTML, silently, forever.
    const request = new NextRequest('http://localhost:3000/n8n/intake', { method: 'POST' });
    const response = proxy(request);

    expect(response.headers.get('location')).toBeNull();
  });
});
