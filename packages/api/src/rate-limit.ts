import { ApiRateLimitError, ApiValidationError } from './errors.js';

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly resetAtEpochSeconds: number;
}

export interface RateLimiter {
  consume(principalKey: string, nowMilliseconds?: number): RateLimitDecision;
}

interface FixedWindowRecord {
  count: number;
  windowStartedAt: number;
}

export interface FixedWindowRateLimiterOptions {
  readonly limit: number;
  readonly windowMilliseconds: number;
  readonly maximumTrackedPrincipals?: number;
}

export class FixedWindowRateLimiter implements RateLimiter {
  readonly #records = new Map<string, FixedWindowRecord>();
  readonly #limit: number;
  readonly #windowMilliseconds: number;
  readonly #maximumTrackedPrincipals: number;

  public constructor(options: FixedWindowRateLimiterOptions) {
    if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
      throw new ApiValidationError('Rate-limit count must be a positive integer.');
    }
    if (
      !Number.isSafeInteger(options.windowMilliseconds) ||
      options.windowMilliseconds <= 0
    ) {
      throw new ApiValidationError(
        'Rate-limit window must be a positive integer number of milliseconds.',
      );
    }
    const maximumTrackedPrincipals = options.maximumTrackedPrincipals ?? 10_000;
    if (
      !Number.isSafeInteger(maximumTrackedPrincipals) ||
      maximumTrackedPrincipals <= 0
    ) {
      throw new ApiValidationError(
        'Maximum tracked principals must be a positive integer.',
      );
    }
    this.#limit = options.limit;
    this.#windowMilliseconds = options.windowMilliseconds;
    this.#maximumTrackedPrincipals = maximumTrackedPrincipals;
  }

  public consume(
    principalKeyRaw: string,
    nowMilliseconds = Date.now(),
  ): RateLimitDecision {
    const principalKey = principalKeyRaw.trim();
    if (principalKey === '') {
      throw new ApiValidationError('Rate-limit principal key is required.');
    }
    this.#prune(nowMilliseconds);
    const existing = this.#records.get(principalKey);
    const expired =
      existing === undefined ||
      nowMilliseconds - existing.windowStartedAt >= this.#windowMilliseconds;
    const record: FixedWindowRecord = expired
      ? { count: 0, windowStartedAt: nowMilliseconds }
      : existing;
    record.count += 1;
    this.#records.set(principalKey, record);
    const resetAtMilliseconds = record.windowStartedAt + this.#windowMilliseconds;
    const allowed = record.count <= this.#limit;
    return Object.freeze({
      allowed,
      limit: this.#limit,
      remaining: Math.max(0, this.#limit - record.count),
      resetAtEpochSeconds: Math.ceil(resetAtMilliseconds / 1000),
    });
  }

  public enforce(
    principalKey: string,
    nowMilliseconds = Date.now(),
  ): RateLimitDecision {
    const decision = this.consume(principalKey, nowMilliseconds);
    if (!decision.allowed) {
      throw new ApiRateLimitError('The API rate limit has been exceeded.', {
        limit: decision.limit,
        remaining: decision.remaining,
        resetAtEpochSeconds: decision.resetAtEpochSeconds,
      });
    }
    return decision;
  }

  #prune(nowMilliseconds: number): void {
    for (const [key, record] of this.#records) {
      if (
        nowMilliseconds - record.windowStartedAt >=
        this.#windowMilliseconds
      ) {
        this.#records.delete(key);
      }
    }
    while (this.#records.size >= this.#maximumTrackedPrincipals) {
      const oldest = this.#records.keys().next().value;
      if (oldest === undefined) break;
      this.#records.delete(oldest);
    }
  }
}
