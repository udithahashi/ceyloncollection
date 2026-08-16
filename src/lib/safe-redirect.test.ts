/**
 * Tests for redirect validation.
 *
 * Weighted heavily towards the rejections, because this function exists to stop an
 * open redirect and a helper that lets one through while passing its happy-path
 * tests is worse than no helper at all.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_REDIRECT, NEVER_REDIRECT_TO, safeRedirect } from './safe-redirect';

/** Every page in NEVER_REDIRECT_TO belongs to the (auth) route group. */
const AUTH_GROUP = join(process.cwd(), 'src', 'app', '(back-office)', '(auth)');

describe('safeRedirect', () => {
  it('allows a same-site absolute path', () => {
    expect(safeRedirect('/admin/leads')).toBe('/admin/leads');
    expect(safeRedirect('/admin/leads/8f2c')).toBe('/admin/leads/8f2c');
  });

  it('keeps the query string and fragment', () => {
    expect(safeRedirect('/admin/leads?status=new#top')).toBe('/admin/leads?status=new#top');
  });

  describe('rejects off-site targets', () => {
    it.each([
      ['an absolute URL', 'https://evil.test/login'],
      ['an http URL', 'http://evil.test'],
      ['a protocol-relative URL', '//evil.test'],
      ['a protocol-relative URL with a path', '//evil.test/leads'],
      ['a backslash variant', '/\\evil.test'],
      ['a scheme after a slash', '/https://evil.test'],
      ['a javascript URL', 'javascript:alert(1)'],
      ['a data URL', 'data:text/html,<script>alert(1)</script>'],
      ['a mailto link', 'mailto:someone@evil.test'],
      ['a bare hostname', 'evil.test'],
      ['a relative path', 'leads'],
      ['a parent-relative path', '../admin'],
    ])('%s', (_label, target) => {
      expect(safeRedirect(target)).toBe(DEFAULT_REDIRECT);
    });
  });

  describe('rejects malformed input', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
      ['a number', 42],
      ['an array', ['/admin/leads']],
      ['an object', { path: '/admin/leads' }],
    ])('%s', (_label, target) => {
      expect(safeRedirect(target)).toBe(DEFAULT_REDIRECT);
    });

    it('a newline, which could smuggle a header', () => {
      expect(safeRedirect('/leads\r\nSet-Cookie: x=1')).toBe(DEFAULT_REDIRECT);
    });

    it('a null byte', () => {
      expect(safeRedirect('/leads\u0000')).toBe(DEFAULT_REDIRECT);
    });

    it('a tab inside the path', () => {
      expect(safeRedirect('/lea\tds')).toBe(DEFAULT_REDIRECT);
    });
  });

  describe('rejects destinations that would bounce straight back', () => {
    it.each(NEVER_REDIRECT_TO)('%s', (target) => {
      expect(safeRedirect(target)).toBe(DEFAULT_REDIRECT);
    });

    it('including their subpaths', () => {
      expect(safeRedirect('/accept-invitation/abc')).toBe(DEFAULT_REDIRECT);
    });

    it('but not a path that merely starts with the same letters', () => {
      expect(safeRedirect('/logins-report')).toBe('/logins-report');
    });

    /**
     * The list is written by hand and the routes it names live somewhere else,
     * so the two drift apart the moment a page is renamed - and a stale entry
     * fails silently, blocking nothing. `/accept-invite` sat here for months
     * matching no route at all. This is the same guard `proxy.test.ts` puts on
     * PUBLIC_PATHS, for the same reason.
     */
    it.each(NEVER_REDIRECT_TO)('%s is a route that exists', (path) => {
      const page = join(AUTH_GROUP, path.slice(1), 'page.tsx');
      expect(existsSync(page), `${path} has no page under (auth)`).toBe(true);
    });
  });

  it('honours a custom fallback', () => {
    expect(safeRedirect('https://evil.test', '/dashboard')).toBe('/dashboard');
  });
});
