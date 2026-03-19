import { APIResource, requireParam, validateParam } from "../core/resource.js";
import { DomainRecords } from "./domains/domain-records.js";
import { DomainSettings } from "./domains/settings.js";
import { DomainFirewallRules } from "./domains/firewall-rules.js";
import { interpolatePath, type TrafficmindClient } from "../core/client.js";
import { makePage, type Page } from "../core/pagination.js";

import type { RequestOptions } from "../core/client.js";
import type { APIPromise } from "../core/api-promise.js";
import type {
  DomainListResponse,
  DomainResponse,
  DomainRemovalResponse,
  CreateDomainRequest,
  ResponseDomainRecord,
  ResponseDomainId,
} from "../types.js";

export type DomainsListParams = {
  /** Free-form search query for domain names. */
  query?: string;
  /** Match strategy for query value. */
  match_mode?:
    | "contains"
    | "starts_with"
    | "ends_with"
    | "not_equal"
    | "equal"
    | "starts_with_case_sensitive"
    | "ends_with_case_sensitive"
    | "contains_case_sensitive";
  /** Page number of paginated results. */
  page?: number;
  /** Number of domains per page. @minimum 5 @maximum 50 */
  page_size?: number;
};

export type DomainsGetParams = { domain_id: string };
export type DomainsDeleteParams = { domain_id: string };

/**
 * Domains API.
 */
export class Domains extends APIResource {
  readonly domainRecords: DomainRecords;
  readonly settings: DomainSettings;
  readonly firewallRules: DomainFirewallRules;

  constructor(client: TrafficmindClient) {
    super(client);
    this.domainRecords = new DomainRecords(client);
    this.settings = new DomainSettings(client);
    this.firewallRules = new DomainFirewallRules(client);
  }

  /**
   * Lists, searches, sorts, and filters your domains.
   */
  listDomains(
    query: DomainsListParams = {},
    options: RequestOptions = {},
  ): APIPromise<Page<ResponseDomainRecord>> {
    validateParam("page_size", query.page_size, { min: 5, max: 50 });
    return this._client
      .get<DomainListResponse>("/public/v1/domains", { ...options, query })
      ._thenUnwrapWithMeta(
        (r) => makePage(r.payload?.items, r.payload?.pagination),
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Auto-paginates through domains (yields `ResponseDomain` items).
   */
  async *listAll(
    query: Omit<DomainsListParams, "page"> = {},
    options: RequestOptions = {},
  ): AsyncIterable<ResponseDomainRecord> {
    let page = 1;
    const page_size = query.page_size ?? 50;
    while (true) {
      const resp = await this.listDomains(
        { ...query, page, page_size },
        options,
      );
      for (const z of resp) yield z;
      const pagination = resp.pagination;
      const total = pagination?.total ?? undefined;
      const count = pagination?.items ?? resp.length;
      if (total !== undefined) {
        if (page * page_size >= total) break;
      } else {
        if (count < page_size) break;
      }
      page += 1;
    }
  }

  /**
   * Create Domain.
   */
  createDomain(
    body: CreateDomainRequest,
    options: RequestOptions = {},
  ): APIPromise<ResponseDomainRecord> {
    validateParam("name", body.name, { maxLength: 253 });
    return this._client
      .post<DomainResponse>("/public/v1/domains", { ...options, body })
      ._thenUnwrapWithMeta(
        (r) => r.payload?.domain as ResponseDomainRecord,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Domain Details.
   */
  getDomain(
    params: DomainsGetParams,
    options: RequestOptions = {},
  ): APIPromise<ResponseDomainRecord> {
    requireParam("domain_id", params.domain_id);
    const path = interpolatePath("/public/v1/domains/{domain_id}", params);
    return this._client.get<DomainResponse>(path, options)._thenUnwrapWithMeta(
      (r) => r.payload?.domain as ResponseDomainRecord,
      (r) => ({ meta: r.meta, status: r.status }),
    );
  }

  /**
   * Delete Domain.
   */
  deleteDomain(
    params: DomainsDeleteParams,
    options: RequestOptions = {},
  ): APIPromise<ResponseDomainId> {
    requireParam("domain_id", params.domain_id);
    const path = interpolatePath("/public/v1/domains/{domain_id}", params);
    return this._client
      .delete<DomainRemovalResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.domain as ResponseDomainId,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
