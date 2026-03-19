import type { ResponseMeta, ApiResponseStatus } from "../types.js";

export type WithResponse<T> = { data: T; response: Response };

/**
 * Enriched result that includes the API-level `meta` and `status` fields
 * returned by every Trafficmind endpoint alongside the actual payload data,
 * as well as the raw HTTP status code (e.g. 201 for created resources).
 *
 * Obtain it via `.withMeta()`:
 * ```ts
 * const { data, meta, status, httpStatus } = await client.domains.create(...).withMeta();
 * console.log(httpStatus);    // 201
 * console.log(meta?.request_id, status?.code);
 * ```
 */
export type WithMeta<T> = {
  data: T;
  meta: ResponseMeta | undefined;
  status: ApiResponseStatus | undefined;
  /** Raw HTTP status code of the response (e.g. 200, 201, 204). */
  httpStatus: number;
};

/**
 * A Promise wrapper that also exposes the raw `Response`.
 *
 * `await`-ing this returns the parsed data.
 * Use `.asResponse()` or `.withResponse()` when you need headers/status.
 * Use `.withMeta()` when you need the API-level `meta` and `status` fields.
 */
export class APIPromise<T> implements Promise<T> {
  readonly [Symbol.toStringTag] = "Promise";

  private readonly inner: Promise<WithResponse<T>>;
  private readonly dataPromise: Promise<T>;
  /** @internal Populated by _thenUnwrapWithMeta to carry meta/status upstream. */
  _metaCarrier?: Promise<WithMeta<T>>;

  constructor(inner: Promise<WithResponse<T>>) {
    this.inner = inner;
    // Attach a rejection handler so Node doesn't treat inner rejections as unhandled.
    this.dataPromise = inner.then(
      (r) => r.data,
      (err) => {
        throw err;
      },
    );
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.dataPromise.then(
      onfulfilled ?? undefined,
      onrejected ?? undefined,
    );
  }

  catch<TResult = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.dataPromise.catch(onrejected ?? undefined);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.dataPromise.finally(onfinally ?? undefined);
  }

  asResponse(): Promise<Response> {
    return this.inner.then((r) => r.response);
  }

  withResponse(): Promise<WithResponse<T>> {
    return this.inner;
  }

  /**
   * Returns the parsed payload data together with the API-level `meta`
   * (request_id, timestamp) and `status` (code, message) envelopes.
   *
   * Useful when you need to inspect infrastructure metadata without
   * switching to the raw HTTP response:
   *
   * ```ts
   * const { data, meta, status } = await client.domains.get({ domain_id }).withMeta();
   * console.log(meta?.request_id); // e.g. "req_01abc..."
   * console.log(status?.code);     // e.g. "OK"
   * ```
   */
  withMeta(): Promise<WithMeta<T>> {
    if (this._metaCarrier) {
      // When the caller awaits _metaCarrier instead of the main dataPromise,
      // dataPromise has no rejection handler attached by the caller — attach a
      // no-op here so Node doesn't emit an unhandledRejection for it.
      void this.catch(() => {});
      return this._metaCarrier;
    }
    // Fallback: no meta was attached (e.g. called on a raw client.get() result).
    return this.inner.then(({ data, response }) => ({
      data,
      meta: undefined,
      status: undefined,
      httpStatus: response.status,
    }));
  }

  /**
   * Internal helper: like `_thenUnwrap` but also carries `meta` and `status`
   * from the raw envelope so that `.withMeta()` works on the resulting promise.
   *
   * @internal
   */
  _thenUnwrapWithMeta<U>(
    fn: (data: T) => U,
    getMeta: (data: T) => {
      meta: ResponseMeta | undefined;
      status: ApiResponseStatus | undefined;
    },
  ): APIPromise<U> {
    void this.catch(() => {});

    const inner = this.withResponse().then(
      ({ data, response }) => ({ data: fn(data), response }),
      (err) => {
        throw err;
      },
    );
    const result = new APIPromise<U>(inner);

    // Wire up the meta carrier so callers can do .withMeta().
    // Attach a no-op rejection handler so that if the request fails and the
    // caller only awaits the main promise (not .withMeta()), Node does not
    // emit an unhandledRejection for the carrier promise.
    result._metaCarrier = this.withResponse().then(({ data, response }) => {
      const { meta, status } = getMeta(data);
      return { data: fn(data), meta, status, httpStatus: response.status };
    });
    void result._metaCarrier.catch(() => {});

    return result;
  }
}
