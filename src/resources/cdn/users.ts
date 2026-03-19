import { APIResource, requireParam } from "../../core/resource.js";
import { interpolatePath } from "../../core/client.js";

import type { RequestOptions } from "../../core/client.js";
import type { APIPromise } from "../../core/api-promise.js";
import type {
  CDNUserEnvelopeResponse,
  CDNUserResponse,
  CreateCDNUserRequest,
} from "../../types.js";

export type CDNUsersRevokeParams = { username: string };

export class CDNUsers extends APIResource {
  /**
   * Create CDN SFTP user.
   */
  createCdnUser(
    body: CreateCDNUserRequest,
    options: RequestOptions = {},
  ): APIPromise<CDNUserResponse> {
    return this._client
      .post<CDNUserEnvelopeResponse>("/public/v1/cdn/user", {
        ...options,
        body,
      })
      ._thenUnwrapWithMeta(
        (r) => r.payload?.user as CDNUserResponse,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Revoke CDN SFTP user credentials.
   */
  revokeCdnUser(
    params: CDNUsersRevokeParams,
    options: RequestOptions = {},
  ): APIPromise<CDNUserResponse> {
    requireParam("username", params.username);
    const path = interpolatePath(
      "/public/v1/cdn/user/{username}/revoke",
      params,
    );
    return this._client
      .post<CDNUserEnvelopeResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.user as CDNUserResponse,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
