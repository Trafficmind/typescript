import { TrafficmindClient } from "./core/client.js";
import type { ClientOptions, RequestOptions } from "./core/client.js";
import type { APIPromise } from "./core/api-promise.js";

import { Domains } from "./resources/domains.js";
import { Accounts } from "./resources/accounts.js";
import { CDN } from "./resources/cdn.js";

/**
 * Trafficmind TypeScript SDK.
 *
 * Auth headers used:
 * - X-Access-User
 * - X-Access-Key
 */
export default class Trafficmind extends TrafficmindClient {
  readonly domains: Domains;
  readonly accounts: Accounts;
  readonly cdn: CDN;

  constructor(opts: ClientOptions) {
    super(opts);
    this.domains = new Domains(this);
    this.accounts = new Accounts(this);
    this.cdn = new CDN(this);
  }

  /**
   * Make an arbitrary GET request (for undocumented endpoints).
   */
  override get<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return super.get<T>(path, opts);
  }

  /**
   * Make an arbitrary POST request (for undocumented endpoints).
   */
  override post<T>(path: string, opts?: RequestOptions): APIPromise<T> {
    return super.post<T>(path, opts);
  }
}
