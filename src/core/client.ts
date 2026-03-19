import { APIPromise } from "./api-promise.js";
import {
  APIConnectionError,
  type APIError,
  errorFromResponse,
} from "./api-error.js";
import { getRetryDelay, shouldRetry, sleep } from "./retry.js";
import type { RequestHook } from "./hooks.js";

const USER_AGENT = `trafficmind-typescript-sdk/1.0.0 node/${process.versions.node}`;

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type RequestOptions = {
  /** Additional headers (merged with default + auth headers). */
  headers?: Record<string, string | undefined>;
  /** Query parameters appended to the URL. */
  query?: Record<string, unknown>;
  /** JSON body (serialized as application/json). */
  body?: unknown;
  /**
   * AbortSignal for request cancellation.
   * Combined with the client-level timeout signal when both are present.
   */
  signal?: AbortSignal;
  /** When set, adds an X-Idempotency-Key header to the request. */
  idempotencyKey?: string;
};

export type ClientOptions = {
  /**
   * Base URL of your Trafficmind API instance.
   * Must use HTTPS (http:// is allowed only for localhost/127.x in development).
   * Default: https://api.trafficmind.com
   */
  baseURL?: string;
  /**
   * Email used for authentication (X-Access-User).
   * Must not be empty.
   */
  accessUser: string;
  /**
   * Global API key used for authentication (X-Access-Key).
   * Must not be empty.
   */
  accessKey: string;
  /** Optional custom fetch implementation. Defaults to global fetch. */
  fetch?: FetchLike;
  /** Optional extra headers added to every request. */
  defaultHeaders?: Record<string, string | undefined>;
  /**
   * Maximum number of automatic retries on retryable errors (429, 5xx, network failures).
   * Uses exponential backoff with jitter between attempts.
   * Set to 0 to disable retries entirely.
   * Default: 2.
   */
  maxRetries?: number;
  /**
   * Request timeout in milliseconds applied to every request.
   * Set to 0 to disable the timeout entirely.
   * Default: 60000 (60 seconds).
   */
  timeout?: number;

  /** Optional hook called on every request, response, and error. */
  onRequest?: RequestHook;
};

export function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        sp.append(k, String(item));
      }
      continue;
    }
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function interpolatePath(
  pathTemplate: string,
  params?: Record<string, string>,
): string {
  if (!params) return pathTemplate;
  return pathTemplate.replace(/\{([A-Za-z0-9_]+)\}/g, (_, k: string) => {
    const val = params[k];
    if (val === undefined) throw new Error(`Missing required path param: ${k}`);
    return encodeURIComponent(val);
  });
}

/**
 * Low-level HTTP client for the Trafficmind API.
 *
 * All configuration is validated eagerly in the constructor so that
 * misconfigured clients fail immediately rather than at first request.
 *
 * Credentials are redacted from util.inspect / JSON.stringify output to
 * prevent accidental leakage into logs or error reports.
 */
export class TrafficmindClient {
  readonly baseURL: string;
  readonly accessUser: string;
  readonly accessKey: string;
  readonly fetch: FetchLike;
  readonly defaultHeaders?: Record<string, string | undefined>;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly onRequest?: RequestHook;

  constructor(opts: ClientOptions) {
    this.#validateOptions(opts);

    this.baseURL = (opts.baseURL ?? "https://api.trafficmind.com").replace(
      /\/+$/,
      "",
    );
    this.accessUser = opts.accessUser;
    this.accessKey = opts.accessKey;
    this.maxRetries = opts.maxRetries ?? 2;
    this.timeout = opts.timeout ?? 60_000;
    this.onRequest = opts.onRequest;
    this.fetch = opts.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!this.fetch) {
      throw new Error(
        "No fetch implementation found. Provide `fetch` in client options or run on Node 18+ / a runtime with global fetch.",
      );
    }
    this.defaultHeaders = opts.defaultHeaders;
  }

  [Symbol.for("nodejs.util.inspect.custom")](): object {
    return {
      baseURL: this.baseURL,
      accessUser: "***REDACTED***",
      accessKey: "***REDACTED***",
      maxRetries: this.maxRetries,
      timeout: this.timeout,
    };
  }

  toJSON(): object {
    return {
      baseURL: this.baseURL,
      accessUser: "***REDACTED***",
      accessKey: "***REDACTED***",
      maxRetries: this.maxRetries,
      timeout: this.timeout,
    };
  }

  request<T>(
    method: string,
    path: string,
    opts: RequestOptions = {},
  ): APIPromise<T> {
    const url = `${this.baseURL}${path}${buildQuery(opts.query)}`;

    const inner = (async () => {
      let attempt = 0;

      while (true) {
        const headers = new Headers();
        headers.set("X-Access-User", this.accessUser);
        headers.set("X-Access-Key", this.accessKey);
        headers.set("Accept", "application/json");
        headers.set("User-Agent", USER_AGENT);

        if (this.defaultHeaders) {
          for (const [k, v] of Object.entries(this.defaultHeaders)) {
            if (v !== undefined) headers.set(k, v);
          }
        }
        if (opts.headers) {
          for (const [k, v] of Object.entries(opts.headers)) {
            if (v !== undefined) headers.set(k, v);
          }
        }

        if (opts.idempotencyKey) {
          headers.set("X-Idempotency-Key", opts.idempotencyKey);
        }

        const signal = this.#buildSignal(opts.signal);
        const init: RequestInit = { method, headers, signal };

        if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
          headers.set("Content-Type", "application/json");
          init.body = JSON.stringify(opts.body);
        }

        const startMs = Date.now();
        this.onRequest?.({ type: "request", method, url, attempt });

        let response: Response;
        let error: APIError | APIConnectionError | undefined;

        try {
          response = await this.fetch(url, init);
        } catch (err) {
          const durationMs = Date.now() - startMs;
          const connErr = this.#wrapFetchError(err);
          this.onRequest?.({
            type: "error",
            method,
            url,
            attempt,
            durationMs,
            error: connErr,
          });
          if (shouldRetry(connErr, attempt, this.maxRetries)) {
            await sleep(getRetryDelay(connErr, attempt));
            attempt++;
            continue;
          }
          throw connErr;
        }

        const durationMs = Date.now() - startMs;
        const contentType = response.headers.get("content-type") ?? "";
        let data: unknown = undefined;

        if (contentType.includes("application/json")) {
          try {
            data = await response.json();
          } catch {
            data = undefined;
          }
        } else if (response.status !== 204) {
          try {
            data = await response.text();
          } catch {
            data = undefined;
          }
        }

        if (!response.ok) {
          error = errorFromResponse({
            status: response.status,
            headers: response.headers,
            body: data,
          });
        }

        if (error !== undefined) {
          this.onRequest?.({
            type: "error",
            method,
            url,
            attempt,
            durationMs,
            error,
          });
          if (shouldRetry(error, attempt, this.maxRetries)) {
            await sleep(getRetryDelay(error, attempt));
            attempt++;
            continue;
          }
          throw error;
        }

        this.onRequest?.({
          type: "response",
          method,
          url,
          attempt,
          status: response.status,
          durationMs,
        });
        return { data: data as T, response };
      }
    })();

    return new APIPromise(inner);
  }

  get<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return this.request<T>("GET", path, opts);
  }
  post<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return this.request<T>("POST", path, opts);
  }
  put<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return this.request<T>("PUT", path, opts);
  }
  patch<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return this.request<T>("PATCH", path, opts);
  }
  delete<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return this.request<T>("DELETE", path, opts);
  }

  /**
   * Builds the AbortSignal passed to fetch for this request.
   *
   * Priority:
   * - timeout: 0 and no userSignal → undefined (no cancellation)
   * - timeout only                 → AbortSignal.timeout(ms)
   * - userSignal only              → userSignal as-is
   * - both                        → AbortSignal.any([timeout, userSignal])
   */
  #buildSignal(userSignal?: AbortSignal): AbortSignal | undefined {
    const timeoutSignal =
      this.timeout > 0 ? AbortSignal.timeout(this.timeout) : undefined;

    if (!timeoutSignal && !userSignal) return undefined;
    if (!timeoutSignal) return userSignal;
    if (!userSignal) return timeoutSignal;

    // On Node 18 fall back to a manual AbortController bridge.
    if (typeof AbortSignal.any === "function") {
      return AbortSignal.any([timeoutSignal, userSignal]);
    }

    const controller = new AbortController();
    const abort = () =>
      controller.abort(
        userSignal.aborted ? userSignal.reason : timeoutSignal.reason,
      );
    if (timeoutSignal.aborted || userSignal.aborted) {
      abort();
    } else {
      timeoutSignal.addEventListener("abort", abort, { once: true });
      userSignal.addEventListener("abort", abort, { once: true });
    }
    return controller.signal;
  }

  #wrapFetchError(err: unknown): APIConnectionError {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return new APIConnectionError(
        `Request timed out after ${this.timeout}ms. ` +
          "Increase the `timeout` option if you expect slower responses.",
        err,
      );
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      return new APIConnectionError("Request was aborted.", err);
    }
    return new APIConnectionError("Failed to connect to Trafficmind API", err);
  }

  #validateOptions(opts: ClientOptions): void {
    if (!opts.accessUser || !opts.accessUser.trim()) {
      throw new TypeError(
        "[TrafficmindClient] accessUser is required and must not be empty.",
      );
    }
    if (!opts.accessKey || !opts.accessKey.trim()) {
      throw new TypeError(
        "[TrafficmindClient] accessKey is required and must not be empty.",
      );
    }
    const base = opts.baseURL ?? "https://api.trafficmind.com";
    if (
      !base.startsWith("https://") &&
      !base.startsWith("http://localhost") &&
      !base.startsWith("http://127.")
    ) {
      throw new TypeError(
        `[TrafficmindClient] baseURL must use HTTPS. Received: "${base}". ` +
          "HTTP is only allowed for localhost/127.x in development.",
      );
    }
    if (
      opts.maxRetries !== undefined &&
      (opts.maxRetries < 0 || !Number.isInteger(opts.maxRetries))
    ) {
      throw new TypeError(
        "[TrafficmindClient] maxRetries must be a non-negative integer.",
      );
    }
    if (
      opts.timeout !== undefined &&
      (opts.timeout < 0 || !Number.isFinite(opts.timeout))
    ) {
      throw new TypeError(
        "[TrafficmindClient] timeout must be a non-negative number.",
      );
    }
  }
}
