import { APIResource } from "../core/resource.js";
import type { TrafficmindClient } from "../core/client.js";
import { AccountFirewallRules } from "./accounts/firewall-rules.js";

export class Accounts extends APIResource {
  readonly firewallRules: AccountFirewallRules;

  constructor(client: TrafficmindClient) {
    super(client);
    this.firewallRules = new AccountFirewallRules(client);
  }
}
