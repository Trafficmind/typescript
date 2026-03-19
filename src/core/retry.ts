import {
  type APIConnectionError,
  type APIError,
  RateLimitError,
} from "./api-error.js";

/** Maximum delay between retries in milliseconds. */
const MAX_DELAY_MS = 30_000;

/**
 * Calculates how long to wait before the next attempt.
 *
 * Uses exponential backoff with jitter: min(30s, 2^attempt * 1000ms) + random(0..200ms).
 * If the error is a RateLimitError with a Retry-After header, that value takes precedence.
 */
export function getRetryDelay(
  error: APIError | APIConnectionError,
  attempt: number,
): number {
  if (error instanceof RateLimitError && error.retryAfter !== null) {
    return error.retryAfter * 1000 + Math.random() * 200;
  }
  const backoff = Math.min(MAX_DELAY_MS, Math.pow(2, attempt) * 1000);
  return backoff + Math.random() * 200;
}

/**
 * Returns true if the error is safe to retry and the attempt limit has not been reached.
 */
export function shouldRetry(
  error: APIError | APIConnectionError,
  attempt: number,
  maxRetries: number,
): boolean {
  if (attempt >= maxRetries) return false;
  return error.isRetryable();
}

/** Returns a Promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
