import { APIResource } from "../../core/resource.js";
import { interpolatePath } from "../../core/client.js";

import type { RequestOptions } from "../../core/client.js";
import type { APIPromise } from "../../core/api-promise.js";
import type {
  UpdateDomainSettingRequest,
  DomainSettingResponse,
  ResponseDomainSetting,
} from "../../types.js";

export type DomainSettingsGetParams = {
  domain_id: string;
  setting_id: string;
};

export type DomainSettingsUpdateParams = {
  domain_id: string;
  setting_id: string;
  body: UpdateDomainSettingRequest;
};

/**
 * Domain settings API.
 */
export class DomainSettings extends APIResource {
  /**
   * Get a domain setting.
   */
  getDomainSetting(
    params: DomainSettingsGetParams,
    options: RequestOptions = {},
  ): APIPromise<ResponseDomainSetting> {
    const path = interpolatePath(
      "/public/v1/domains/{domain_id}/settings/{setting_id}",
      params,
    );
    return this._client
      .get<DomainSettingResponse>(path, options)
      ._thenUnwrapWithMeta(
        (r) => r.payload?.setting as ResponseDomainSetting,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }

  /**
   * Update a domain setting (PATCH).
   */
  updateDomainSetting(
    params: DomainSettingsUpdateParams,
    options: RequestOptions = {},
  ): APIPromise<ResponseDomainSetting> {
    const path = interpolatePath(
      "/public/v1/domains/{domain_id}/settings/{setting_id}",
      {
        domain_id: params.domain_id,
        setting_id: params.setting_id,
      },
    );
    return this._client
      .patch<DomainSettingResponse>(path, { ...options, body: params.body })
      ._thenUnwrapWithMeta(
        (r) => r.payload?.setting as ResponseDomainSetting,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
