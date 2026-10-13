/**
 * Result returned after evaluating rate limits for an identity key.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Configuration options for initializing a RateLimiter instance.
 */
export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * In-memory token-window rate limiter for MVP application tiers.
 * Note: Suitable for single-node deployments. Distributed environments should back this with Redis.
 */
export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly records = new Map<string, RateLimitRecord>();

  constructor(options: RateLimiterOptions) {
    if (options.windowMs <= 0) {
      throw new Error('RateLimiter windowMs must be greater than zero.');
    }
    if (options.maxRequests <= 0) {
      throw new Error('RateLimiter maxRequests must be greater than zero.');
    }
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Checks whether the given key is within the permissible rate window.
   *
   * @param key - Unique subject identifier (e.g., client IP or session ULID)
   * @returns RateLimitResult with allowance status and remaining quotas
   */
  public checkLimit(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.records.get(key);

    // Evict old entries if store is growing large
    if (this.records.size > 5000) {
      this.pruneExpired(now);
    }

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.records.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        resetAt,
      };
    }

    if (existing.count < this.maxRequests) {
      existing.count += 1;
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - existing.count),
        resetAt: existing.resetAt,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  /**
   * Resets rate limiting state for a key, or clears all records if no key is provided.
   *
   * @param key - Optional key to clear
   */
  public reset(key?: string): void {
    if (key) {
      this.records.delete(key);
    } else {
      this.records.clear();
    }
  }

  /**
   * Cleans out expired records from memory.
   */
  private pruneExpired(now: number): void {
    for (const [key, record] of this.records.entries()) {
      if (record.resetAt <= now) {
        this.records.delete(key);
      }
    }
  }
}

/**
 * Authentication limiter: 10 requests per 15 minutes per IP
 */
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
});

/**
 * General API limiter: 100 requests per minute per IP
 */
export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
});

/**
 * Checkout operations limiter: 5 requests per minute per session
 */
export const checkoutLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
});

/**
 * Analytics reporting limiter: 60 requests per minute per session
 */
export const analyticsLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
});
