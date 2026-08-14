/**
 * Tests for redirect validation.
 *
 * Weighted heavily towards the rejections, because this function exists to stop an
 * open redirect and a helper that lets one through while passing its happy-path
 * tests is worse than no helper at all.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_REDIRECT, safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('allows a same-site absolute path', () => {
    expect(safeRedirect('/leads')).toBe('/leads');
    expect(safeRedirect('/leads/8f2c')).toBe('/leads/8f2c');
  });

  it('keeps the query string and fragment', () => {
    expect(safeRedirect('/leads?status=new#top')).toBe('/leads?status=new#top');
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
      ['an array', ['/leads']],
      ['an object', { path: '/leads' }],
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
    it.each(['/login', '/two-factor', '/setup-two-factor', '/accept-invite'])('%s', (target) => {
      expect(safeRedirect(target)).toBe(DEFAULT_REDIRECT);
    });

    it('including their subpaths', () => {
      expect(safeRedirect('/accept-invite/abc')).toBe(DEFAULT_REDIRECT);
    });

    it('but not a path that merely starts with the same letters', () => {
      expect(safeRedirect('/logins-report')).toBe('/logins-report');
    });
  });

  it('honours a custom fallback', () => {
    expect(safeRedirect('https://evil.test', '/dashboard')).toBe('/dashboard');
  });
});
