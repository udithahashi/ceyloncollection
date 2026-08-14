/**
 * Tests for the paths the proxy lets through without a session.
 *
 * The list is written by hand and the routes it names live somewhere else entirely,
 * so the two drift apart the moment a page is renamed. When they drift the symptom is
 * a page that redirects to the login form for no visible reason - which reads as a
 * session bug and costs an hour before anyone suspects a string literal.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PUBLIC_PATHS } from './proxy';

const AUTH_GROUP = join(process.cwd(), 'src', 'app', '(auth)');

describe('PUBLIC_PATHS', () => {
  it.each(PUBLIC_PATHS)('%s is a route that exists', (path) => {
    // Every unauthenticated page belongs to the (auth) route group. If one ever needs
    // to live elsewhere, this assertion is the right place to notice.
    expect(existsSync(join(AUTH_GROUP, path.slice(1), 'page.tsx')), `${path} has no page`).toBe(
      true
    );
  });

  it('does not expose an authenticated page by accident', () => {
    // These three each need a session, so none of them may appear in the list: the
    // shortcut would skip the redirect and render a layout that then bounces anyway.
    for (const path of ['/', '/team', '/setup-two-factor', '/access-denied']) {
      expect(PUBLIC_PATHS, `${path} must not be public`).not.toContain(path);
    }
  });

  it('lists absolute paths only', () => {
    // `startsWith` matching in the proxy means a relative entry would match nothing,
    // and a trailing slash would fail to match the page itself.
    for (const path of PUBLIC_PATHS) {
      expect(path.startsWith('/'), `${path} must start with a slash`).toBe(true);
      expect(path.endsWith('/'), `${path} must not end with a slash`).toBe(false);
    }
  });
});
