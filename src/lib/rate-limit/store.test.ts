/**
 * Tests for the rate limit store.
 *
 * The in-memory implementation is tested directly with an injected clock. It is
 * the same window arithmetic the Lua script performs, so a logic error here is a
 * logic error there.
 */
import { describe, expect, it } from 'vitest';

import { createMemoryStore, type RateLimitRule } from './store';

const rule: RateLimitRule = { limit: 3, windowMs: 1_000 };

describe('memory rate limit store', () => {
  it('allows attempts up to the limit and reports the remainder', async () => {
    const store = createMemoryStore();

    expect(await store.consume('a', rule, 0)).toMatchObject({ allowed: true, remaining: 2 });
    expect(await store.consume('a', rule, 10)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await store.consume('a', rule, 20)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('denies the attempt after the limit and says when to retry', async () => {
    const store = createMemoryStore();
    for (const at of [0, 10, 20]) await store.consume('a', rule, at);

    const denied = await store.consume('a', rule, 30);

    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    // The oldest attempt was at 0, so the window frees up at 1000.
    expect(denied.retryAfterMs).toBe(970);
  });

  it('keeps counts separate per key', async () => {
    const store = createMemoryStore();
    for (const at of [0, 10, 20]) await store.consume('a', rule, at);

    expect(await store.consume('b', rule, 30)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it('slides rather than resetting, so a boundary gives no double allowance', async () => {
    const store = createMemoryStore();
    // Three attempts spread across the window.
    for (const at of [0, 500, 900]) await store.consume('a', rule, at);

    // At 1001 only the attempt at 0 has aged out, so exactly one slot opens.
    expect(await store.consume('a', rule, 1_001)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await store.consume('a', rule, 1_002)).toMatchObject({ allowed: false });

    // A fixed window would have cleared all three at 1000 and allowed three more.
  });

  it('forgets attempts once the window has fully passed', async () => {
    const store = createMemoryStore();
    for (const at of [0, 10, 20]) await store.consume('a', rule, at);

    expect(await store.consume('a', rule, 2_000)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it('never reports a retry delay below one millisecond', async () => {
    const store = createMemoryStore();
    for (const at of [0, 0, 0]) await store.consume('a', rule, at);

    // One millisecond before the window frees up, so a caller that sleeps for
    // retryAfterMs and retries cannot spin on a zero delay.
    const denied = await store.consume('a', rule, 999);
    expect(denied.retryAfterMs).toBe(1);
  });

  it('clears the window on reset', async () => {
    const store = createMemoryStore();
    for (const at of [0, 10, 20]) await store.consume('a', rule, at);
    expect(await store.consume('a', rule, 30)).toMatchObject({ allowed: false });

    await store.reset('a');

    expect(await store.consume('a', rule, 40)).toMatchObject({ allowed: true, remaining: 2 });
  });
});
