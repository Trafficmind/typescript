import { APIResource } from "../../core/resource.js";
import { interpolatePath } from "../../core/client.js";

import type { RequestOptions } from "../../core/client.js";
import type { APIPromise } from "../../core/api-promise.js";
import type {
  ActionAckResponse,
  BasicPayload,
  CreateDomainAccessRuleRequest,
} from "../../types.js";

export type DomainFirewallRuleCreateParams = {
  domain_id: string;
  body: CreateDomainAccessRuleRequest;
};

/**
 * Domain firewall access rules API.
 */
export class DomainFirewallRules extends APIResource {
  /**
   * Create access rule for domain.
   */
  createDomainFirewallRule(
    params: DomainFirewallRuleCreateParams,
    options: RequestOptions = {},
  ): APIPromise<BasicPayload> {
    const path = interpolatePath(
      "/public/v1/domains/{domain_id}/firewall_rules",
      { domain_id: params.domain_id },
    );
    return this._client
      .post<ActionAckResponse>(path, { ...options, body: params.body })
      ._thenUnwrapWithMeta(
        (r) => r.payload as BasicPayload,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
