import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitStatus {
  allowed: boolean;
  attempts: number;
  maxAttempts: number;
  retryAfterSeconds: number;
  isNewlyBlocked: boolean;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // Key -> Array of timestamps (ms)
  private readonly attemptsMap = new Map<string, number[]>();

  // Default: 5 attempts per 2 hours
  public static readonly DEFAULT_MAX_ATTEMPTS = 5;
  public static readonly DEFAULT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours (7,200,000 ms)

  constructor() {
    // Run cleanup every 15 minutes to prevent memory leaks
    setInterval(() => this.cleanupExpired(), 15 * 60 * 1000);
  }

  /**
   * Checks if the given key is currently within rate limits without incrementing.
   */
  checkLimit(
    key: string,
    maxAttempts: number = RateLimiterService.DEFAULT_MAX_ATTEMPTS,
    windowMs: number = RateLimiterService.DEFAULT_WINDOW_MS,
  ): RateLimitStatus {
    const now = Date.now();
    const timestamps = (this.attemptsMap.get(key) || []).filter(
      (ts) => now - ts < windowMs,
    );

    const attempts = timestamps.length;
    const allowed = attempts < maxAttempts;

    let retryAfterSeconds = 0;
    if (!allowed && timestamps.length > 0) {
      const oldestRelevant = timestamps[0];
      const expiry = oldestRelevant + windowMs;
      retryAfterSeconds = Math.max(1, Math.ceil((expiry - now) / 1000));
    }

    return {
      allowed,
      attempts,
      maxAttempts,
      retryAfterSeconds,
      isNewlyBlocked: false,
    };
  }

  /**
   * Records a failed/rate-limited attempt for the given key and returns the updated status.
   */
  recordAttempt(
    key: string,
    maxAttempts: number = RateLimiterService.DEFAULT_MAX_ATTEMPTS,
    windowMs: number = RateLimiterService.DEFAULT_WINDOW_MS,
  ): RateLimitStatus {
    const now = Date.now();
    const timestamps = (this.attemptsMap.get(key) || []).filter(
      (ts) => now - ts < windowMs,
    );

    const prevAttempts = timestamps.length;
    timestamps.push(now);
    this.attemptsMap.set(key, timestamps);

    const currentAttempts = timestamps.length;
    const allowed = currentAttempts <= maxAttempts;
    const isNewlyBlocked = prevAttempts < maxAttempts && currentAttempts >= maxAttempts;

    const oldestRelevant = timestamps[0];
    const expiry = oldestRelevant + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((expiry - now) / 1000));

    if (isNewlyBlocked) {
      this.logger.warn(
        `[RATE-LIMIT] Key "${key}" reached maximum limit (${currentAttempts}/${maxAttempts}). Blocked for ${retryAfterSeconds}s.`,
      );
    }

    return {
      allowed,
      attempts: currentAttempts,
      maxAttempts,
      retryAfterSeconds,
      isNewlyBlocked,
    };
  }

  /**
   * Resets rate limit for a given key on successful completion if required.
   */
  reset(key: string): void {
    this.attemptsMap.delete(key);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const defaultWindow = RateLimiterService.DEFAULT_WINDOW_MS;

    for (const [key, timestamps] of this.attemptsMap.entries()) {
      const valid = timestamps.filter((ts) => now - ts < defaultWindow);
      if (valid.length === 0) {
        this.attemptsMap.delete(key);
      } else {
        this.attemptsMap.set(key, valid);
      }
    }
  }
}
