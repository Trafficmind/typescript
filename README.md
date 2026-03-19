# Trafficmind TypeScript SDK

<a href="https://www.npmjs.com/package/trafficmind-typescript-sdk"><img src="https://img.shields.io/npm/v/trafficmind-typescript-sdk" alt="npm"></a>

Official TypeScript SDK for the Trafficmind **Client API** (`/public/v1`): domains, domain records, CDN, firewall rules and domain settings.

## Configuration

Trafficmind SDK requires API credentials to authenticate requests.

### Required environment variables

```dotenv
# Trafficmind API credentials
TRAFFICMIND_ACCESS_USER=example@trafficmind.com
TRAFFICMIND_ACCESS_KEY=example_api_key_123
```

### Optional environment variable

```dotenv
# Base URL for Trafficmind API (optional, defaults to https://api.trafficmind.com)
TRAFFICMIND_BASE_URL=https://api.trafficmind.com
```

---

## Requirements

- Node.js **18+** (built-in global `fetch`)
- ESM or CommonJS environment (SDK ships both formats)

## Installation

```bash
npm install trafficmind-typescript-sdk
```

### From GitHub

```bash
npm install github:trafficmind/typescript
```

## Authentication

All requests automatically include:

- `X-Access-User` — email associated with your account.
- `X-Access-Key` — global API key.

By default requests go to `https://api.trafficmind.com`. Use `baseURL` to point
the SDK at a staging or private deployment.

> `baseURL` must use HTTPS. HTTP is only allowed for `localhost` and `127.x` in development.

## Quick start

```ts
import Trafficmind from 'trafficmind-typescript-sdk';

const client = new Trafficmind({
    accessUser: process.env.TRAFFICMIND_ACCESS_USER!,
    accessKey:   process.env.TRAFFICMIND_ACCESS_KEY!,
});

const domains = await client.domains.listDomains({ page_size: 20 });

console.log('domains count:', domains.length);

for (const domain of domains) {
    console.log(domain.id, domain.name);
}

// Auto-pagination — iterate all domains without manual page handling
for await (const domain of client.domains.listAll({ page_size: 50 })) {
    console.log(domain.id, domain.name);
}
```

See `examples/smoke.mjs` for a more complete example with error handling.

## Available resources

| Resource                        | Description                                    |
|---------------------------------|------------------------------------------------|
| `client.domains`                | List, create, get, and delete domains          |
| `client.domains.domainRecords`  | List and batch domain records                  |
| `client.domains.settings`       | Get and update domain settings                  |
| `client.domains.firewallRules`  | Create domain-level firewall rules             |
| `client.accounts.firewallRules` | Create account-level firewall rules            |
| `client.cdn.storage`            | List, create, delete, and refresh CDN storages |
| `client.cdn.users`              | Create and revoke CDN SFTP users               |

## Error handling

Non-2xx responses and `success: false` payloads throw typed error classes:

| Status | Class |
|--------|-------|
| 400 | `BadRequestError` |
| 401 | `AuthenticationError` |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `UnprocessableEntityError` |
| 429 | `RateLimitError` |
| ≥500 | `InternalServerError` |
| Network failure | `APIConnectionError` |

```ts
import Trafficmind, {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  APIError,
} from 'trafficmind-typescript-sdk';

try {
  const domains = await client.domains.listDomains();
} catch (e) {
  if (e instanceof AuthenticationError) {
    // 401 / 403
  } else if (e instanceof NotFoundError) {
    // 404
  } else if (e instanceof RateLimitError) {
    console.log('retry after:', e.retryAfter, 's');
  } else if (e instanceof APIError) {
    console.log(e.status, e.message);
  }
  throw e;
}
```

## Retries

The client automatically retries failed requests with exponential backoff and jitter.

- Default: **2 retries** for `429`, `500`, `502`, `503`, `504`, and network errors.
- `429` responses respect the `Retry-After` header when present.
- Set `maxRetries: 0` to disable retries entirely.

```ts
const client = new Trafficmind({
  accessUser:  process.env.TRAFFICMIND_ACCESS_USER!,
  accessKey:    process.env.TRAFFICMIND_ACCESS_KEY!,
  maxRetries: 5,  // default: 2, set 0 to disable
});
```

Backoff formula: `min(30s, 2^attempt * 1000ms) + random(0..200ms)`.

## Timeouts

Default timeout is **60 seconds**. Override at the client level or per request via `AbortSignal`.

```ts
// Client-level timeout
const client = new Trafficmind({
  accessUser: process.env.TRAFFICMIND_ACCESS_USER!, 
  accessKey:   process.env.TRAFFICMIND_ACCESS_KEY!,
  timeout:   10_000, // 10 seconds, set 0 to disable
});

// Per-request timeout via AbortSignal
const domains = await client.domains.listDomains({}, {
  signal: AbortSignal.timeout(5_000),
});
```

When both a client-level timeout and a per-request signal are present, whichever fires first aborts the request.

## Idempotency Key

For safe retries of non-idempotent requests (POST, PUT, PATCH), pass an idempotency key.
The SDK sends it as the `X-Idempotency-Key` header:

```ts
import { randomUUID } from 'node:crypto';

await client.domains.createDomain(
  { name: 'example.com' },
  { idempotencyKey: randomUUID() },
);
```

If the request is retried after a network failure, the server uses the key to return
the original response instead of creating a duplicate resource.

## Observability

Pass an `onRequest` hook to log every request, response, and error — without any vendor lock-in:

```ts
const client = new Trafficmind({
    accessUser:  process.env.TRAFFICMIND_ACCESS_USER!,
    accessKey:    process.env.TRAFFICMIND_ACCESS_KEY!,
    onRequest: (event) => {
        if (event.type === 'request') {
            console.log(`→ ${event.method} ${event.url} (attempt ${event.attempt})`);
        } else if (event.type === 'response') {
            console.log(`← ${event.status} in ${event.durationMs}ms`);
        } else if (event.type === 'error') {
            console.error(`✖ ${event.error} in ${event.durationMs}ms`);
        }
    },
});
```

### OpenTelemetry integration

```ts
import {trace, SpanStatusCode} from '@opentelemetry/api';

const tracer = trace.getTracer('trafficmind-sdk');
const spans = new Map<number, ReturnType<typeof tracer.startSpan>>();

const client = new Trafficmind({
    accessUser: process.env.TRAFFICMIND_ACCESS_USER!,
    accessKey: process.env.TRAFFICMIND_ACCESS_KEY!,
    onRequest: (event) => {
        if (event.type === 'request') {
            const span = tracer.startSpan(`${event.method} ${event.url}`);
            spans.set(event.attempt, span);
        } else if (event.type === 'response') {
            spans.get(event.attempt)?.setStatus({code: SpanStatusCode.OK}).end();
        } else if (event.type === 'error') {
            spans.get(event.attempt)?.setStatus({code: SpanStatusCode.ERROR}).end();
        }
    },
});
```

## CJS / ESM

The SDK ships both ESM and CommonJS builds — no configuration needed.

```ts
// ESM (TypeScript, Node with "type": "module")
import Trafficmind from 'trafficmind-typescript-sdk';

// CommonJS (legacy Node, Jest without transform)
const Trafficmind = require('trafficmind-typescript-sdk');
```

## Pagination

Use `listAll()` to lazily iterate all pages without loading everything into memory:

```ts
// Iterate all domains
for await (const domain of client.domains.listAll({ page_size: 50 })) {
    console.log(domain.id, domain.name);
}

// Iterate all domain records for a domain
for await (const record of client.domains.domainRecords.listAll({ domain_id: 'domain_123' })) {
    console.log(record.name, record.type);
}
```

Use `listDomains()` for a single page:

```ts
const page = await client.domains.listDomains({ page: 2, page_size: 50 });
console.log(page.result_info?.total_count);
```

## Project structure

```
src/
  trafficmind.ts        — root client class
  core/
    client.ts           — HTTP client, auth, retry, timeout, hooks
    api-error.ts        — error class hierarchy
    api-promise.ts      — APIPromise wrapper
    hooks.ts            — onRequest hook types
    pagination.ts       — Page type and helpers
    resource.ts         — base APIResource class
    retry.ts            — backoff and retry logic
  resources/
    domains.ts          — domains resource
    domains/            — domain records, settings, firewall rules
    accounts.ts         — accounts resource
    accounts/           — firewall rules
    cdn.ts              — CDN resource
    cdn/                — storage, users
  types.ts              — shared API types
dist/
  esm/                  — ESM build output
  cjs/                  — CommonJS build output
examples/
  smoke.mjs             — live API smoke test
test/
  sdk.test.js           — unit tests (no real network calls)
```

## Running tests & checks

Tests use an injected `fetch` stub and do not require network access:
```bash
# Build + run all tests
npm test

# Run all checks at once (format + lint + typecheck + test)
npm run check
```

### Individual commands
```bash
# Type check without emitting files
npm run typecheck

# ESLint
npm run lint

# Prettier format check (dry-run)
npm run cs-check

# Prettier auto-fix
npm run cs-fix

# Test coverage report
npm run coverage
```

## Security

- Treat API keys as secrets — do not commit credentials.
- Prefer environment variables or a secrets manager.
- Credentials are automatically redacted from `util.inspect()` and `JSON.stringify()` output.
- See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Support & Compatibility

- Supported Node versions: **18, 20, 22**
- Supported API: `/public/v1`
- Deprecated SDK APIs will be marked with a JSDoc `@deprecated` tag at least one minor version before removal.

## Versioning

This SDK follows [Semantic Versioning](https://semver.org/):

- Patch releases `1.0.x` — bug fixes, no breaking changes
- Minor releases `1.x.0` — new features, no breaking changes
- Major releases `x.0.0` — breaking changes, migration guide provided

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history and breaking changes.

## License

Apache-2.0. See [LICENSE](LICENSE).
