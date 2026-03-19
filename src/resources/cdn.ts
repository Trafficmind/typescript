import { APIResource } from "../core/resource.js";
import type { TrafficmindClient } from "../core/client.js";
import { CDNStorage } from "./cdn/storage.js";
import { CDNUsers } from "./cdn/users.js";

export class CDN extends APIResource {
  readonly storage: CDNStorage;
  readonly users: CDNUsers;

  constructor(client: TrafficmindClient) {
    super(client);
    this.storage = new CDNStorage(client);
    this.users = new CDNUsers(client);
  }
}
