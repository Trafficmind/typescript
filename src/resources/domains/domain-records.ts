import {
  APIResource,
  requireParam,
  validateParam,
} from "../../core/resource.js";
import { interpolatePath } from "../../core/client.js";
import { makePage, type Page } from "../../core/pagination.js";

import type { RequestOptions } from "../../core/client.js";
import type { APIPromise } from "../../core/api-promise.js";
import type {
  DomainRecordListResponse,
  DomainRecordBatchResponse,
  BatchDNSRequest,
  ResponseDnsRecordsBatchesResult,
  DomainDNSRecord,
} from "../../types.js";

export type DomainRecordsListParams = {
  domain_id: string;
  /** Search query for record names. */
  query?: string;
  page?: number;
  page_size?: number;
};

export type DomainRecordsBatchParams = {
  domain_id: string;
  body: BatchDNSRequest;
};

/**
 * Domain Records API (domain-scoped).
 */
export class DomainRecords extends APIResource {
  /**
   * Lists domain records for a domain.
   */
  listDomainRecords(
    params: DomainRecordsListParams,
    options: RequestOptions = {},
  ): APIPromise<Page<DomainDNSRecord>> {
    requireParam("domain_id", params.domain_id);
    validateParam("page_size", params.page_size, { min: 5, max: 50 });
    const { domain_id, ...query } = params;
    const path = interpolatePath("/public/v1/domains/{domain_id}/records", {
      domain_id,
    });
    return this._client
      .get<DomainRecordListResponse>(path, { ...options, query })
      ._thenUnwrapWithMeta(
        (r) => makePage(r.payload?.items, r.payload?.pagination),
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Auto-paginates domain records (yields `DomainRecord` items).
   */
  async *listAll(
    params: Omit<DomainRecordsListParams, "page">,
    options: RequestOptions = {},
  ): AsyncIterable<DomainDNSRecord> {
    let page = 1;
    const page_size = params.page_size ?? 50;
    while (true) {
      const resp = await this.listDomainRecords(
        { ...params, page, page_size },
        options,
      );
      for (const r of resp) yield r;
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
   * Batch operations for domain records (create/update/delete).
   */
  batchDomainRecords(
    params: DomainRecordsBatchParams,
    options: RequestOptions = {},
  ): APIPromise<ResponseDnsRecordsBatchesResult> {
    const path = interpolatePath(
      "/public/v1/domains/{domain_id}/records/batch",
      { domain_id: params.domain_id },
    );
    return this._client
      .post<DomainRecordBatchResponse>(path, {
        ...options,
        body: params.body,
      })
      ._thenUnwrapWithMeta(
        (r) => (r.payload?.batch ?? {}) as ResponseDnsRecordsBatchesResult,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
