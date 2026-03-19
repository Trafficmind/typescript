import { APIResource } from "../../core/resource.js";
import { interpolatePath } from "../../core/client.js";

import type { RequestOptions } from "../../core/client.js";
import type { APIPromise } from "../../core/api-promise.js";
import type {
  ActionAckResponse,
  BasicPayload,
  CreateAccountAccessRuleRequest,
} from "../../types.js";

export type AccountFirewallRulesCreateParams = {
  account_id: string;
  body: CreateAccountAccessRuleRequest;
};

/**
 * Account-level firewall access rules.
 */
export class AccountFirewallRules extends APIResource {
  /**
   * Create new firewall rule for all domains in account.
   */
  createAccountFirewallRule(
    params: AccountFirewallRulesCreateParams,
    options: RequestOptions = {},
  ): APIPromise<BasicPayload> {
    const path = interpolatePath(
      "/public/v1/accounts/{account_id}/firewall_rules",
      { account_id: params.account_id },
    );
    return this._client
      .post<ActionAckResponse>(path, { ...options, body: params.body })
      ._thenUnwrapWithMeta(
        (r) => r.payload as BasicPayload,
        (r) => ({ meta: r.meta, status: r.status }),
      );
  }
}
