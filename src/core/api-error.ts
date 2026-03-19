type BodyLike = Record<string, unknown> & {
  error?: unknown | { message?: unknown };
};

export class APIError extends Error {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;

  constructor(
    message: string,
    opts: { status: number; headers: Headers; body: unknown },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = opts.status;
    this.headers = opts.headers;
    this.body = opts.body;
  }

  /**
   * Returns true if the request is safe to retry.
   * Rate-limit (429) and server errors (5xx) are retryable.
   * Client errors (4xx except 429) are not — retrying them won't change the outcome.
   */
  isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/**
 * Thrown when the HTTP connection itself fails (DNS, TCP, TLS)
 * before any response is received.
 *
 * Always retryable — the server may not have received the request at all.
 */
export class APIConnectionError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }

  isRetryable(): boolean {
    return true;
  }
}

export class BadRequestError extends APIError {} // 400

export class AuthenticationError extends APIError {} // 401

export class PermissionDeniedError extends APIError {} // 403

export class NotFoundError extends APIError {} // 404

/**
 * 409 Conflict.
 * Typically, means a resource already exists or there is a concurrent modification.
 */
export class ConflictError extends APIError {} // 409

/**
 * 422 Unprocessable Entity.
 * The request was well-formed but failed semantic validation on the server.
 */
export class UnprocessableEntityError extends APIError {} // 422

/**
 * 429 Too Many Requests.
 *
 * `retryAfter` contains the number of seconds to wait before retrying,
 * parsed from the `Retry-After` response header.
 * `null` when the header is absent or unparseable.
 */
export class RateLimitError extends APIError {
  /** Seconds to wait before the next retry, or null if the header was absent. */
  readonly retryAfter: number | null;

  constructor(
    message: string,
    opts: { status: number; headers: Headers; body: unknown },
    retryAfter: number | null,
  ) {
    super(message, opts);
    this.retryAfter = retryAfter;
  }
}

export class InternalServerError extends APIError {} // 500+

/**
 * Parses the `Retry-After` header into a number of seconds.
 * Accepts both the delta-seconds form ("120") and the HTTP-date form
 * ("Wed, 21 Oct 2026 07:28:00 GMT").
 * Returns null when the header is absent or cannot be parsed.
 */
function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;

  const seconds = Number(raw);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds;

  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    const diff = Math.ceil((date - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }

  return null;
}

/**
 * Extracts a human-readable message from an API error response body.
 * Supports: plain string body, { error: { message } }, fallback to status code.
 */
function extractMessage(body: unknown, status: number): string {
  if (typeof body === "string" && body.trim()) return body.trim();

  if (typeof body === "object" && body !== null) {
    const b = body as BodyLike;
    if (typeof b.error === "object" && b.error !== null) {
      const errObj = b.error as Record<string, unknown>;
      if (typeof errObj.message === "string" && errObj.message.trim())
        return errObj.message.trim();
    }
  }

  return `Request failed with status ${status}`;
}

export function errorFromResponse(opts: {
  status: number;
  headers: Headers;
  body: unknown;
}): APIError {
  const { status, headers, body } = opts;
  const message = extractMessage(body, status);

  if (status === 400) return new BadRequestError(message, opts);
  if (status === 401) return new AuthenticationError(message, opts);
  if (status === 403) return new PermissionDeniedError(message, opts);
  if (status === 404) return new NotFoundError(message, opts);
  if (status === 409) return new ConflictError(message, opts);
  if (status === 422) return new UnprocessableEntityError(message, opts);
  if (status === 429)
    return new RateLimitError(message, opts, parseRetryAfter(headers));
  if (status >= 500) return new InternalServerError(message, opts);
  return new APIError(message, opts);
}
