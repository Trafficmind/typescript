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
  CDNStorageListResponse,
  CDNStorageEnvelopeResponse,
  CDNUserEnvelopeResponse,
  CDNStorageResponse,
  CDNUserResponse,
  CreateCDNStorageRequest,
  OperationResultResponse,
  SuccessResponse,
  SyncStateResponse,
  SyncStatus,
} from "../../types.js";

export type CDNStorageDeleteParams = { storage_id: string };
export type CDNStorageRefreshParams = { storage_id: string };
export type CDNStorageGetUserParams = { storage_id: string };

export type CDNStorageListParams = {
  /** Page number of paginated results. */
  page?: number;
  /** Number of storages per page. @minimum 5 @maximum 50 */
  page_size?: number;
};

export class CDNStorage extends APIResource {
  /**
   * List CDN storages.
   * Returns items alongside pagination metadata (total, page, page_size).
   */
  listCdnStorages(
    params: CDNStorageListParams = {},
    options: RequestOptions = {},
  ): APIPromise<Page<CDNStorageResponse>> {
    validateParam("page_size", params.page_size, { min: 5, max: 50 });
    return this._client
      .get<CDNStorageListResponse>("/public/v1/cdn/storage", {
        ...options,
        query: params,
      })
      ._thenUnwrapWithMeta(
        (r) => makePage(r.payload?.items, r.payload?.pagination),
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Auto-paginates through all CDN storages (yields `CDNStorageResponse` items).
   */
  async *listAll(
    params: Omit<CDNStorageListParams, "page"> = {},
    options: RequestOptions = {},
  ): AsyncIterable<CDNStorageResponse> {
    let page = 1;
    const page_size = params.page_size ?? 50;
    while (true) {
      const resp = await this.listCdnStorages(
        { ...params, page, page_size },
        options,
      );
      for (const item of resp) yield item;
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
   * Create CDN storage.
   */
  createCdnStorage(
    body: CreateCDNStorageRequest,
    options: RequestOptions = {},
  ): APIPromise<CDNStorageResponse> {
    validateParam("name", body.name, { maxLength: 255 });
    return this._client
      .post<CDNStorageEnvelopeResponse>("/public/v1/cdn/storage", {
        ...options,
        body,
      })
      ._thenUnwrapWithMeta(
        (r) => r.payload?.storage as CDNStorageResponse,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Delete CDN storage.
   */
  deleteCdnStorage(
    params: CDNStorageDeleteParams,
    options: RequestOptions = {},
  ): APIPromise<SuccessResponse> {
    requireParam("storage_id", params.storage_id);
    const path = interpolatePath("/public/v1/cdn/storage/{storage_id}", params);
    return this._client
      .delete<OperationResultResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.result as SuccessResponse,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Refresh CDN storage.
   */
  refreshCdnStorage(
    params: CDNStorageRefreshParams,
    options: RequestOptions = {},
  ): APIPromise<SyncStatus> {
    requireParam("storage_id", params.storage_id);
    const path = interpolatePath(
      "/public/v1/cdn/storage/{storage_id}/refresh",
      params,
    );
    return this._client
      .post<SyncStateResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.sync as SyncStatus,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Get SFTP user for storage.
   */
  getCdnStorageUser(
    params: CDNStorageGetUserParams,
    options: RequestOptions = {},
  ): APIPromise<CDNUserResponse> {
    requireParam("storage_id", params.storage_id);
    const path = interpolatePath(
      "/public/v1/cdn/storage/{storage_id}/user",
      params,
    );
    return this._client
      .get<CDNUserEnvelopeResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.user as CDNUserResponse,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
