import { describe, expect, it } from 'vitest';

import {
  ApiRateLimitError,
  FixedWindowRateLimiter,
} from '../src/index.js';

describe('FixedWindowRateLimiter', () => {
  it('enforces a per-principal fixed window and resets after expiry', () => {
    const limiter = new FixedWindowRateLimiter({
      limit: 2,
      windowMilliseconds: 1_000,
    });

    expect(limiter.enforce('carrier:user', 1_000).remaining).toBe(1);
    expect(limiter.enforce('carrier:user', 1_100).remaining).toBe(0);
    expect(() => limiter.enforce('carrier:user', 1_200)).toThrow(
      ApiRateLimitError,
    );
    expect(limiter.enforce('carrier:user', 2_000).remaining).toBe(1);
  });

  it('keeps principals isolated', () => {
    const limiter = new FixedWindowRateLimiter({
      limit: 1,
      windowMilliseconds: 1_000,
    });

    expect(limiter.consume('first', 1_000).allowed).toBe(true);
    expect(limiter.consume('first', 1_001).allowed).toBe(false);
    expect(limiter.consume('second', 1_001).allowed).toBe(true);
  });
});
