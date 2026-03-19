export type Base64String = string & { readonly __base64__: unique symbol };

export interface ResponseMeta {
  /** Server-side request identifier. */
  request_id?: string;
  /** UTC response time in RFC3339 format. */
  timestamp?: string;
}

export interface ApiResponseStatus {
  /** Machine-readable status code. */
  code?: string;
  /** Human-readable status description. */
  message?: string;
}

export interface ApiErrorStatus {
  /** Machine-readable error code. */
  code?: string;
  /** Human-readable error description. */
  message?: string;
}

export interface ErrorDetail {
  /** Optional target field for validation errors. */
  field?: string;
  /** Error message for end user. */
  message?: string;
}

export interface ErrorBody {
  /** Human-readable error description. */
  message?: string;
  /** Short machine-readable error type. */
  type?: string;
  /** Optional detailed list of issues. */
  details?: ErrorDetail[];
}

export interface ApiErrorResponse {
  error?: ErrorBody;
  meta?: ResponseMeta;
  status?: ApiErrorStatus;
}

/** Pagination metadata returned inside payload.pagination */
export interface PaginationMeta {
  /** Number of entities in current response. */
  items?: number;
  /** Current page index. */
  page?: number;
  /** Requested page size. */
  page_size?: number;
  /** Total entities count. */
  total?: number;
}

export interface DomainAccount {
  id?: string;
  name?: string;
}

export interface ResponseDomainRecord {
  id?: string;
  name?: string;
  account?: DomainAccount;
  group_id?: number;
  assigned_nameservers?: string[];
  original_nameservers?: string[];
}

export interface ResponseDomainId {
  id?: string;
}

export interface DomainListPayload {
  items?: ResponseDomainRecord[];
  pagination?: PaginationMeta;
}

export interface DomainPayload {
  domain?: ResponseDomainRecord;
}

export interface DomainRemovalPayload {
  domain?: ResponseDomainId;
}

export interface DomainListResponse {
  meta?: ResponseMeta;
  payload?: DomainListPayload;
  status?: ApiResponseStatus;
}

export interface DomainResponse {
  meta?: ResponseMeta;
  payload?: DomainPayload;
  status?: ApiResponseStatus;
}

export interface DomainRemovalResponse {
  meta?: ResponseMeta;
  payload?: DomainRemovalPayload;
  status?: ApiResponseStatus;
}

export interface DomainDNSRecord {
  id?: string;
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface BatchDNSDelete {
  id?: string;
}

export interface BatchDNSUpdate {
  id?: string;
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface BatchDNSCreate {
  id?: string;
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface BatchDNSReplace {
  id?: string;
  type?: string;
  name?: string;
  content?: string;
  proxied?: boolean;
  ttl?: number;
  comment?: string;
}

export interface ResponseDnsRecordsBatchesResult {
  creates?: DomainDNSRecord[];
  updates?: DomainDNSRecord[];
  replaces?: DomainDNSRecord[];
  deletes?: DomainDNSRecord[];
}

export interface DomainRecordListPayload {
  items?: DomainDNSRecord[];
  pagination?: PaginationMeta;
  search_query?: string;
}

export interface DomainRecordBatchPayload {
  batch?: ResponseDnsRecordsBatchesResult;
}

export interface DomainRecordListResponse {
  meta?: ResponseMeta;
  payload?: DomainRecordListPayload;
  status?: ApiResponseStatus;
}

export interface DomainRecordBatchResponse {
  meta?: ResponseMeta;
  payload?: DomainRecordBatchPayload;
  status?: ApiResponseStatus;
}

export interface ResponseDomainSetting {
  id?: string;
  value?: string;
}

export interface DomainSettingPayload {
  setting?: ResponseDomainSetting;
}

export interface DomainSettingResponse {
  meta?: ResponseMeta;
  payload?: DomainSettingPayload;
  status?: ApiResponseStatus;
}

export interface RefreshedCDN {
  address?: string;
  name?: string;
  status?: boolean;
  refreshed_at?: string;
}

export interface CDNStoragePathResponse {
  id?: string;
  storage_id?: string;
  domain_id?: string;
  path_prefix?: string;
  full_path?: string;
  domain_name?: string;
  subdomain?: string;
}

export interface CDNUserResponse {
  username?: string;
  password?: string;
  storage_id?: string;
  sftp_host?: string;
  sftp_port?: number;
}

export interface CDNStorageResponse {
  id?: string;
  name?: string;
  files_count?: number;
  bytes_total?: number;
  needs_refresh?: boolean;
  start_refresh_at?: string;
  last_refresh_at?: string;
  last_file_change_at?: string;
  deleted_at?: string;
  purge_at?: string;
  cdn_user?: CDNUserResponse;
  synced_dc?: RefreshedCDN[];
  paths?: CDNStoragePathResponse[];
}

export interface CDNStorageListPayload {
  items?: CDNStorageResponse[];
  pagination?: PaginationMeta;
}

export interface CDNStoragePayload {
  storage?: CDNStorageResponse;
}

export interface CDNUserPayload {
  user?: CDNUserResponse;
}

export interface CDNStorageListResponse {
  meta?: ResponseMeta;
  payload?: CDNStorageListPayload;
  status?: ApiResponseStatus;
}

export interface CDNStorageEnvelopeResponse {
  meta?: ResponseMeta;
  payload?: CDNStoragePayload;
  status?: ApiResponseStatus;
}

export interface CDNUserEnvelopeResponse {
  meta?: ResponseMeta;
  payload?: CDNUserPayload;
  status?: ApiResponseStatus;
}

export interface CreateAccessRuleConfiguration {
  target: "ip" | "country";
  value: string;
}

export interface CreateAccountAccessRuleRequest {
  configuration: CreateAccessRuleConfiguration;
  mode: "challenge" | "block" | "allow";
  notes?: string;
}

export interface CreateDomainAccessRuleRequest {
  configuration: CreateAccessRuleConfiguration;
  mode: "challenge" | "block" | "allow";
  notes?: string;
}

export interface BasicPayload {
  acknowledged?: boolean;
}

export interface ActionAckResponse {
  meta?: ResponseMeta;
  payload?: BasicPayload;
  status?: ApiResponseStatus;
}

export interface CreateDomainRequest {
  /** Domain name. @maxLength 253 */
  name: string;
  group_id?: number;
  dns_method?: "auto" | "file" | "manual" | "source";
  source_domain_id?: string;
  dns_file_content?: Base64String;
}

export interface BatchDNSRequest {
  creates?: BatchDNSCreate[];
  updates?: BatchDNSUpdate[];
  replaces?: BatchDNSReplace[];
  deletes?: BatchDNSDelete[];
}

export interface UpdateDomainSettingRequest {
  value?: string;
}

export interface CreateCDNStorageRequest {
  /** @maxLength 255 */
  name: string;
}

export interface CreateCDNUserRequest {
  storage_id: string;
}

export interface SyncStatus {
  status?: string;
}

export interface SyncStatePayload {
  sync?: SyncStatus;
}

export interface SyncStateResponse {
  meta?: ResponseMeta;
  payload?: SyncStatePayload;
  status?: ApiResponseStatus;
}

export interface SuccessResponse {
  message?: string;
}

export interface OperationResultPayload {
  result?: SuccessResponse;
}

export interface OperationResultResponse {
  meta?: ResponseMeta;
  payload?: OperationResultPayload;
  status?: ApiResponseStatus;
}
