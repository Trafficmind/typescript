import test from 'node:test';
import assert from 'node:assert/strict';
import Trafficmind from '../dist/esm/index.js';
import { inspect } from 'node:util';
import { interpolatePath } from '../dist/esm/core/client.js';
import {
  APIError,
  APIConnectionError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  RateLimitError,
  InternalServerError,
} from '../dist/esm/index.js';

function envelope(payload) {
  return {
    meta: { request_id: 'test-req-id', timestamp: '2026-01-01T00:00:00Z' },
    payload,
    status: { code: 'ok', message: 'Request processed successfully' },
  };
}

/**
 * @param {unknown} replyJson
 * @param {{ status?: number, contentType?: string }} [opts]
 */
function makeMockFetch(replyJson = envelope({}), { status = 200, contentType = 'application/json' } = {}) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    calls.push({ input: String(input), init });
    const headers = {};
    if (contentType) headers['content-type'] = contentType;
    const body = contentType?.includes('application/json') ? JSON.stringify(replyJson) : String(replyJson ?? '');
    return new Response(body, { status, headers });
  };
  return { fetch, calls };
}

function makeClient(fetch) {
  return new Trafficmind({
    baseURL   : 'https://api.trafficmind.com',
    accessUser: 'a@example.com',
    accessKey : 'k',
    fetch,
  });
}

function makeClientWithRetries(fetch, maxRetries = 2) {
  return new Trafficmind({
    baseURL   : 'https://api.trafficmind.com',
    accessUser: 'a@example.com',
    accessKey : 'k',
    maxRetries,
    fetch,
  });
}

function makeSequencedMockFetch(sequence, { contentType = 'application/json' } = {}) {
  const calls = [];
  let i = 0;
  const fetch = async (input, init = {}) => {
    calls.push({ input: String(input), init });
    const item = i < sequence.length ? sequence[i] : sequence[sequence.length - 1];
    i += 1;
    const { body: replyJson, status = 200 } = item;
    const headers = {};
    if (contentType) headers['content-type'] = contentType;
    const body = contentType?.includes('application/json') ? JSON.stringify(replyJson) : String(replyJson ?? '');
    return new Response(body, { status, headers });
  };
  return { fetch, calls };
}

function getHeaders(init) {
  return new Headers(init.headers);
}

test('constructor throws TypeError when accessUser is empty', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: '', accessKey: 'k', fetch: () => {} }),
      (err) => err instanceof TypeError && err.message.includes('accessUser'),
  );
});

test('constructor throws TypeError when accessUser is whitespace-only', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: '   ', accessKey: 'k', fetch: () => {} }),
      (err) => err instanceof TypeError && err.message.includes('accessUser'),
  );
});

test('constructor throws TypeError when accessKey is empty', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: '', fetch: () => {} }),
      (err) => err instanceof TypeError && err.message.includes('accessKey'),
  );
});

test('constructor throws TypeError when baseURL uses http:// for non-localhost', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: 'k', baseURL: 'http://api.trafficmind.com', fetch: () => {} }),
      (err) => err instanceof TypeError && err.message.includes('HTTPS'),
  );
});

test('constructor allows http://localhost for development', () => {
  assert.doesNotThrow(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: 'k', baseURL: 'http://localhost:8080', fetch: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) }),
  );
});

test('constructor allows http://127.x for development', () => {
  assert.doesNotThrow(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: 'k', baseURL: 'http://127.0.0.1:3000', fetch: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) }),
  );
});

test('constructor uses default baseURL when none provided', () => {
  const client = new Trafficmind({ accessUser: 'a@example.com', accessKey: 'k', fetch: makeMockFetch().fetch });
  assert.equal(client.baseURL, 'https://api.trafficmind.com');
});

test('constructor uses default maxRetries when none provided', () => {
  const client = new Trafficmind({ accessUser: 'a@example.com', accessKey: 'k', fetch: makeMockFetch().fetch });
  assert.equal(client.maxRetries, 2);
});

test('constructor uses default timeout when none provided', () => {
  const client = new Trafficmind({ accessUser: 'a@example.com', accessKey: 'k', fetch: makeMockFetch().fetch });
  assert.equal(client.timeout, 60_000);
});

test('constructor throws on negative maxRetries', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: 'k', maxRetries: -1, fetch: async () => new Response() }),
      (err) => err instanceof TypeError && err.message.includes('maxRetries'),
  );
});

test('constructor throws on negative timeout', () => {
  assert.throws(
      () => new Trafficmind({ accessUser: 'a@b.com', accessKey: 'k', timeout: -1, fetch: async () => new Response() }),
      (err) => err instanceof TypeError && err.message.includes('timeout'),
  );
});

test('toJSON redacts credentials', () => {
  const client = makeClient(makeMockFetch().fetch);
  const parsed = JSON.parse(JSON.stringify(client));
  assert.equal(parsed.accessUser, '***REDACTED***');
  assert.equal(parsed.accessKey, '***REDACTED***');
  assert.equal(parsed.baseURL, 'https://api.trafficmind.com');
});

test('util.inspect redacts credentials', () => {
  const client = makeClient(makeMockFetch().fetch);
  const output = inspect(client);
  assert.ok(!output.includes('a@example.com'));
  assert.ok(!output.includes("'k'"));
  assert.ok(output.includes('REDACTED'));
});

test('Symbol.for inspect.custom returns redacted object', () => {
  const client = makeClient(makeMockFetch().fetch);
  const result = client[Symbol.for('nodejs.util.inspect.custom')]();
  assert.equal(result.accessUser, '***REDACTED***');
  assert.equal(result.accessKey, '***REDACTED***');
  assert.equal(result.baseURL, 'https://api.trafficmind.com');
  assert.ok('maxRetries' in result);
});

test('client adds auth + Accept headers on every request', async () => {
  const { fetch, calls } = makeMockFetch();
  const client = makeClient(fetch);
  await client.get('/public/v1/domains');
  const headers = getHeaders(calls[0].init);
  assert.equal(headers.get('X-Access-User'), 'a@example.com');
  assert.equal(headers.get('X-Access-Key'), 'k');
  assert.equal(headers.get('Accept'), 'application/json');
});

test('client merges defaultHeaders into every request', async () => {
  const { fetch, calls } = makeMockFetch();
  const client = new Trafficmind({
    baseURL: 'https://api.trafficmind.com',
    accessUser: 'a@example.com',
    accessKey: 'k',
    fetch,
    defaultHeaders: { 'X-Custom-Header': 'custom-value', 'X-Undefined': undefined },
  });
  await client.get('/public/v1/domains');
  const headers = getHeaders(calls[0].init);
  assert.equal(headers.get('X-Custom-Header'), 'custom-value');
  assert.equal(headers.get('X-Undefined'), null);
});

test('client merges per-request headers', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ items: [] }));
  const client = makeClient(fetch);
  await client.get('/public/v1/domains', { headers: { 'X-Custom-Header': 'test-value' } });
  assert.equal(getHeaders(calls[0].init).get('X-Custom-Header'), 'test-value');
});

test('client sends HEAD request without body', async () => {
  const { fetch, calls } = makeMockFetch(null, { status: 200, contentType: '' });
  const client = makeClient(fetch);
  await client.request('HEAD', '/public/v1/domains');
  assert.equal(calls[0].init.method, 'HEAD');
  assert.equal(calls[0].init.body, undefined);
});

test('body not set for HEAD even if opts.body provided', async () => {
  const emptyFetch = async () => new Response('', { status: 200 });
  const client = makeClient(emptyFetch);
  await client.request('HEAD', '/x', { body: { foo: 'bar' } });
});

test('client handles non-JSON response (plain text)', async () => {
  const { fetch } = makeMockFetch('plain text response', { status: 200, contentType: 'text/plain' });
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.get('/x'));
});

test('client handles response without content-type header', async () => {
  const mockFetch = async () => new Response('plain text', { status: 200 });
  const client = new Trafficmind({ accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.doesNotReject(() => client.get('/x'));
});

test('client handles empty body response', async () => {
  const emptyFetch = async () => new Response('', { status: 200, headers: {} });
  const client = makeClient(emptyFetch);
  await assert.doesNotReject(() => client.delete('/x'));
});

test('User-Agent header is present on GET requests', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.get('/public/v1/domains');
  const ua = calls[0].init.headers.get('User-Agent');
  assert.ok(ua?.includes('trafficmind-typescript-sdk'));
  assert.ok(ua?.includes('node/'));
});

test('User-Agent header is present on POST requests', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.post('/public/v1/domains', { body: { name: 'test.com' } });
  assert.ok(calls[0].init.headers.get('User-Agent')?.includes('trafficmind-typescript-sdk'));
});

test('idempotency key header is sent when idempotencyKey is set', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.post('/public/v1/domains', { idempotencyKey: 'my-unique-key-123' });
  assert.equal(calls[0].init.headers.get('X-Idempotency-Key'), 'my-unique-key-123');
});

test('no idempotency key header when not set', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.post('/public/v1/domains', {});
  assert.equal(calls[0].init.headers.get('X-Idempotency-Key'), null);
});

test('interpolatePath returns template unchanged when no params given', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ items: [] }));
  const client = makeClient(fetch);
  await client.get('/public/v1/domains');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/domains');
});

test('interpolatePath throws when required path param is missing', () => {
  assert.throws(
      () => interpolatePath('/domains/{domain_id}', {}),
      (err) => err instanceof Error && err.message.includes('domain_id'),
  );
});

test('buildQuery appends array params correctly', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ items: [] }));
  const client = makeClient(fetch);
  await client.domains.listDomains({ status: ['active', 'pending'] });
  assert.deepEqual(new URL(calls[0].input).searchParams.getAll('status'), ['active', 'pending']);
});

test('buildQuery skips null and undefined array items', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.get('/public/v1/domains', { query: { ids: ['a', null, undefined, 'b'] } });
  assert.equal(new URL(calls[0].input).searchParams.getAll('ids').join(','), 'a,b');
});

test('buildQuery handles mixed array and scalar params', async () => {
  const { fetch, calls } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await client.get('/x', { query: { tags: ['x', 'y'], page: 1 } });
  const url = new URL(calls[0].input);
  assert.deepEqual(url.searchParams.getAll('tags'), ['x', 'y']);
  assert.equal(url.searchParams.get('page'), '1');
});

test('buildQuery returns empty string when all params are undefined/null', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ items: [] }));
  const client = makeClient(fetch);
  await client.domains.listDomains({ name: undefined, page: null });
  assert.equal(new URL(calls[0].input).search, '');
});

test('domains.list builds URL with query params', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 2, page_size: 10, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  await client.domains.listDomains({ query: 'example.com', page: 2, page_size: 10 });
  const url = new URL(calls[0].input);
  assert.equal(url.pathname, '/public/v1/domains');
  assert.equal(url.searchParams.get('query'), 'example.com');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('page_size'), '10');
  assert.equal(calls[0].init.method, 'GET');
});

test('domains.list returns empty page when items is null', async () => {
  const { fetch } = makeMockFetch(envelope({ items: null }));
  const client = makeClient(fetch);
  const page = await client.domains.listDomains();
  assert.equal(page.length, 0);
});

test('domains.list throws TypeError when page_size is below minimum (5)', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.domains.listDomains({ page_size: 4 }),
      (err) => err instanceof TypeError && err.message.includes('page_size'),
  );
});

test('domains.list throws TypeError when page_size exceeds maximum (50)', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.domains.listDomains({ page_size: 51 }),
      (err) => err instanceof TypeError && err.message.includes('page_size'),
  );
});

test('domains.list does not throw when page_size is within range', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [], pagination: { total: 0, page: 1, page_size: 20, items: 0 } }));
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.domains.listDomains({ page_size: 20 }));
});

test('domains.listAll auto-paginates until total is reached', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 'z1' }, { id: 'z2' }, { id: 'z3' }, { id: 'z4' }, { id: 'z5' }], pagination: { page: 1, page_size: 5, items: 5, total: 7 } }) },
    { body: envelope({ items: [{ id: 'z6' }, { id: 'z7' }],                                             pagination: { page: 2, page_size: 5, items: 2, total: 7 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const z of client.domains.listAll({ page_size: 5 })) ids.push(z.id);
  assert.deepEqual(ids, ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].input).searchParams.get('page'), '1');
  assert.equal(new URL(calls[1].input).searchParams.get('page'), '2');
});

test('domains.listAll stops when items count < page_size and no total', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 'z1' }, { id: 'z2' }, { id: 'z3' }, { id: 'z4' }, { id: 'z5' }], pagination: { page: 1, page_size: 5, items: 5 } }) },
    { body: envelope({ items: [{ id: 'z6' }],               pagination: { page: 2, page_size: 5, items: 1 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const z of client.domains.listAll({ page_size: 5 })) ids.push(z.id);
  assert.deepEqual(ids, ['z1', 'z2', 'z3', 'z4', 'z5', 'z6']);
  assert.equal(calls.length, 2);
});

test('domains.listAll uses default page_size of 50 when not specified', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 1, page_size: 50, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  for await (const _ of client.domains.listAll()) {}
  assert.equal(new URL(calls[0].input).searchParams.get('page_size'), '50');
});

test('domains.listAll stops when pagination has no items count and resp.length < page_size', async () => {
  const mockFetch = async () => new Response(
      JSON.stringify(envelope({ items: [{ id: 'z1' }], pagination: { page: 1, page_size: 5 } })),
      { status: 200, headers: { 'content-type': 'application/json' } },
  );
  const client = makeClient(mockFetch);
  const ids = [];
  for await (const z of client.domains.listAll({ page_size: 5 })) ids.push(z.id);
  assert.deepEqual(ids, ['z1']);
});

test('domains.create sends JSON body and unwraps result', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ domain: { id: 'z1', name: 'example.com' } }), { status: 201 });
  const client = makeClient(fetch);
  const domain = await client.domains.createDomain({ name: 'example.com', dns_method: 'manual' });
  assert.equal(domain.id, 'z1');
  assert.equal(domain.name, 'example.com');
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/domains');
  assert.equal(init.method, 'POST');
  assert.equal(getHeaders(init).get('Content-Type'), 'application/json');
  const body = JSON.parse(init.body);
  assert.equal(body.name, 'example.com');
});

test('domains.create throws TypeError when name exceeds 253 characters', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.domains.createDomain({ name: 'a'.repeat(254) }),
      (err) => err instanceof TypeError && err.message.includes('name'),
  );
});

test('domains.create does not throw when name is exactly 253 characters', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'd1', name: 'a'.repeat(253) } }), { status: 201 });
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.domains.createDomain({ name: 'a'.repeat(253) }));
});

test('domains.listAll increments page on each iteration', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 'z1' }, { id: 'z2' }, { id: 'z3' }, { id: 'z4' }, { id: 'z5' }], pagination: { page: 1, page_size: 5, items: 5, total: 15 } }) },
    { body: envelope({ items: [{ id: 'z6' }, { id: 'z7' }, { id: 'z8' }, { id: 'z9' }, { id: 'z10' }], pagination: { page: 2, page_size: 5, items: 5, total: 15 } }) },
    { body: envelope({ items: [{ id: 'z11' }, { id: 'z12' }, { id: 'z13' }, { id: 'z14' }, { id: 'z15' }], pagination: { page: 3, page_size: 5, items: 5, total: 15 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const z of client.domains.listAll({ page_size: 5 })) ids.push(z.id);
  assert.equal(calls.length, 3);
  assert.equal(new URL(calls[0].input).searchParams.get('page'), '1');
  assert.equal(new URL(calls[1].input).searchParams.get('page'), '2');
  assert.equal(new URL(calls[2].input).searchParams.get('page'), '3');
  assert.equal(ids.length, 15);
});

test('validateParam throws TypeError for string shorter than minLength', async () => {
  const { validateParam } = await import('../dist/esm/core/resource.js');
  assert.throws(
      () => validateParam('field', 'ab', { minLength: 5 }),
      (err) => err instanceof TypeError && err.message.includes('field') && err.message.includes('5'),
  );
});

test('validateParam does not throw for string meeting minLength', async () => {
  const { validateParam } = await import('../dist/esm/core/resource.js');
  assert.doesNotThrow(() => validateParam('field', 'abcde', { minLength: 5 }));
});

test('domains.get interpolates domain_id and unwraps result', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ domain: { id: 'domain-123', name: 'example.com' } }));
  const client = makeClient(fetch);
  const domain = await client.domains.getDomain({ domain_id: 'domain-123' });
  assert.equal(domain.id, 'domain-123');
  assert.equal(domain.name, 'example.com');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/domains/domain-123');
  assert.equal(calls[0].init.method, 'GET');
});

test('domains.delete uses DELETE and no body', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ domain: { id: 'domain-123' } }));
  const client = makeClient(fetch);
  await client.domains.deleteDomain({ domain_id: 'domain-123' });
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/domains/domain-123');
  assert.equal(init.method, 'DELETE');
  assert.equal(init.body, undefined);
  assert.equal(getHeaders(init).get('Content-Type'), null);
});

test('validation: domains.get throws TypeError when domain_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.domains.getDomain({ domain_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('domain_id'),
  );
});

test('validation: domains.delete throws TypeError when domain_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.domains.deleteDomain({ domain_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('domain_id'),
  );
});

test('validation: domains.delete throws TypeError when domain_id is whitespace', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.domains.deleteDomain({ domain_id: '   ' }),
      (err) => err instanceof TypeError && err.message.includes('domain_id'),
  );
});

test('domains.domainRecords.list interpolates domain_id and query params', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ items: [] }));
  const client = makeClient(fetch);
  await client.domains.domainRecords.listDomainRecords({ domain_id: 'domain-123', query: 'all', page_size: 5 });
  const url = new URL(calls[0].input);
  assert.equal(url.pathname, '/public/v1/domains/domain-123/records');
  assert.equal(url.searchParams.get('query'), 'all');
  assert.equal(url.searchParams.get('page_size'), '5');
  assert.equal(calls[0].init.method, 'GET');
});

test('domains.domainRecords.listAll paginates by total', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }], pagination: { page: 1, page_size: 5, items: 5, total: 7 } }) },
    { body: envelope({ items: [{ id: 'r6' }, { id: 'r7' }],                                             pagination: { page: 2, page_size: 5, items: 2, total: 7 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const r of client.domains.domainRecords.listAll({ domain_id: 'domain-123', page_size: 5 })) ids.push(r.id);
  assert.deepEqual(ids, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/domains/domain-123/records');
  assert.equal(new URL(calls[1].input).searchParams.get('page'), '2');
});

test('domains.domainRecords.listAll stops when items count < page_size', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 'r1' }], pagination: { page: 1, page_size: 2, items: 1 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const r of client.domains.domainRecords.listAll({ domain_id: 'domain-123', page_size: 2 })) ids.push(r.id);
  assert.deepEqual(ids, ['r1']);
  assert.equal(calls.length, 1);
});

test('domains.domainRecords.listAll uses default page_size of 50', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 1, page_size: 50, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  for await (const _ of client.domains.domainRecords.listAll({ domain_id: 'domain-123' })) {}
  assert.equal(new URL(calls[0].input).searchParams.get('page_size'), '50');
});

test('domains.domainRecords.listAll stops when pagination has no items count and resp.length < page_size', async () => {
  const mockFetch = async () => new Response(
      JSON.stringify(envelope({ items: [{ id: 'r1' }], pagination: { page: 1, page_size: 5 } })),
      { status: 200, headers: { 'content-type': 'application/json' } },
  );
  const client = makeClient(mockFetch);
  const ids = [];
  for await (const r of client.domains.domainRecords.listAll({ domain_id: 'z1', page_size: 5 })) ids.push(r.id);
  assert.deepEqual(ids, ['r1']);
});

test('validation: domainRecords.list throws TypeError when domain_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.domains.domainRecords.listDomainRecords({ domain_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('domain_id'),
  );
});

test('domains.domainRecords.batch POSTs to batch endpoint', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ batch: {} }));
  const client = makeClient(fetch);
  await client.domains.domainRecords.batchDomainRecords({
    domain_id: 'domain-123',
    body     : { deletes: [{ id: 'r1' }], creates: [{ type: 'A', name: 'example.com', content: '1.2.3.4', ttl: 120 }] },
  });
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/domains/domain-123/records/batch');
  assert.equal(init.method, 'POST');
  const body = JSON.parse(init.body);
  assert.deepEqual(body.deletes, [{ id: 'r1' }]);
  assert.equal(body.creates[0].type, 'A');
});

test('domains.domainRecords.batch returns empty object when batch absent', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  const res = await client.domains.domainRecords.batchDomainRecords({ domain_id: 'domain-123', body: { deletes: [{ id: 'r1' }] } });
  assert.deepEqual(res, {});
});

test('domains.settings.get interpolates domain_id and setting_id', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ setting: { id: 'always_online' } }));
  const client = makeClient(fetch);
  await client.domains.settings.getDomainSetting({ domain_id: 'domain-123', setting_id: 'always_online' });
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/domains/domain-123/settings/always_online');
  assert.equal(calls[0].init.method, 'GET');
});

test('domains.settings.update PATCHes setting body', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ setting: { id: 'always_online', value: 'on' } }));
  const client = makeClient(fetch);
  await client.domains.settings.updateDomainSetting({ domain_id: 'domain-123', setting_id: 'always_online', body: { value: 'on' } });
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/domains/domain-123/settings/always_online');
  assert.equal(init.method, 'PATCH');
  assert.equal(JSON.parse(init.body).value, 'on');
});

test('domains.firewallRules.create POSTs body to correct path', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  await client.domains.firewallRules.createDomainFirewallRule({
    domain_id: 'domain-123',
    body     : { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'allow', notes: 'unit-test' },
  });
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/domains/domain-123/firewall_rules');
  assert.equal(init.method, 'POST');
  const parsed = JSON.parse(init.body);
  assert.equal(parsed.mode, 'allow');
  assert.equal(parsed.configuration.value, '1.2.3.4');
});

test('domains.firewallRules.create returns BasicPayload with acknowledged true', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const res = await client.domains.firewallRules.createDomainFirewallRule({
    domain_id: 'domain-123',
    body     : { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'allow' },
  });
  assert.equal(res.acknowledged, true);
});

test('domains.firewallRules.create returns empty BasicPayload when payload absent', async () => {
  const { fetch } = makeMockFetch(envelope({}), { status: 201 });
  const client = makeClient(fetch);
  const res = await client.domains.firewallRules.createDomainFirewallRule({
    domain_id: 'domain-123',
    body     : { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'allow' },
  });
  assert.deepEqual(res, {});
});

test('accounts.firewallRules.create POSTs body to correct path', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  await client.accounts.firewallRules.createAccountFirewallRule({
    account_id: 'acc1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'challenge', notes: 'unit-test' },
  });
  const { input, init } = calls[0];
  assert.equal(new URL(input).pathname, '/public/v1/accounts/acc1/firewall_rules');
  assert.equal(init.method, 'POST');
  const parsed = JSON.parse(init.body);
  assert.equal(parsed.mode, 'challenge');
  assert.equal(parsed.configuration.value, '1.2.3.4');
});

test('accounts.firewallRules.create returns BasicPayload with acknowledged true', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const res = await client.accounts.firewallRules.createAccountFirewallRule({
    account_id: 'acc1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'challenge' },
  });
  assert.equal(res.acknowledged, true);
});

test('accounts.firewallRules.create returns empty BasicPayload when payload absent', async () => {
  const { fetch } = makeMockFetch(envelope({}), { status: 201 });
  const client = makeClient(fetch);
  const res = await client.accounts.firewallRules.createAccountFirewallRule({
    account_id: 'acc1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'block' },
  });
  assert.deepEqual(res, {});
});

test('cdn.storage.list returns Page with items and pagination', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [{ id: 's1', name: 'storage1' }],
    pagination: { page: 1, page_size: 20, items: 1, total: 1 },
  }));
  const client = makeClient(fetch);
  const page = await client.cdn.storage.listCdnStorages();
  assert.equal(page[0].id, 's1');
  assert.equal(page.pagination.total, 1);
  assert.equal(page.pagination.page, 1);
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/storage');
  assert.equal(calls[0].init.method, 'GET');
});

test('cdn.storage.list returns empty Page when items absent', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  const page = await client.cdn.storage.listCdnStorages();
  assert.equal(page.length, 0);
});

test('cdn.storage.list sends page and page_size query params', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 2, page_size: 5, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  await client.cdn.storage.listCdnStorages({ page: 2, page_size: 5 });
  const url = new URL(calls[0].input);
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('page_size'), '5');
});

test('cdn.storage.list pagination meta is undefined when absent', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [{ id: 's1' }] }));
  const client = makeClient(fetch);
  const page = await client.cdn.storage.listCdnStorages();
  assert.equal(page.pagination, undefined);
});

test('cdn.storage.list throws TypeError when page_size is below minimum (5)', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.cdn.storage.listCdnStorages({ page_size: 4 }),
      (err) => err instanceof TypeError && err.message.includes('page_size'),
  );
});

test('cdn.storage.list throws TypeError when page_size exceeds maximum (50)', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.cdn.storage.listCdnStorages({ page_size: 51 }),
      (err) => err instanceof TypeError && err.message.includes('page_size'),
  );
});

test('cdn.storage.list does not throw when page_size is within range', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [], pagination: { total: 0, page: 1, page_size: 20, items: 0 } }));
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.cdn.storage.listCdnStorages({ page_size: 20 }));
});

test('cdn.storage.listAll auto-paginates until total is reached', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }], pagination: { page: 1, page_size: 5, items: 5, total: 7 } }) },
    { body: envelope({ items: [{ id: 's6' }, { id: 's7' }],                                             pagination: { page: 2, page_size: 5, items: 2, total: 7 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const s of client.cdn.storage.listAll({ page_size: 5 })) ids.push(s.id);
  assert.deepEqual(ids, ['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].input).searchParams.get('page'), '1');
  assert.equal(new URL(calls[1].input).searchParams.get('page'), '2');
});

test('cdn.storage.listAll stops when items count < page_size and no total', async () => {
  const { fetch, calls } = makeSequencedMockFetch([
    { body: envelope({ items: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }], pagination: { page: 1, page_size: 5, items: 5 } }) },
    { body: envelope({ items: [{ id: 's6' }],               pagination: { page: 2, page_size: 5, items: 1 } }) },
  ]);
  const client = makeClient(fetch);
  const ids = [];
  for await (const s of client.cdn.storage.listAll({ page_size: 5 })) ids.push(s.id);
  assert.deepEqual(ids, ['s1', 's2', 's3', 's4', 's5', 's6']);
  assert.equal(calls.length, 2);
});

test('cdn.storage.listAll stops when first page is empty', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 1, page_size: 50, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  const ids = [];
  for await (const s of client.cdn.storage.listAll()) ids.push(s.id);
  assert.deepEqual(ids, []);
  assert.equal(calls.length, 1);
});

test('cdn.storage.listAll uses default page_size of 50 when not specified', async () => {
  const { fetch, calls } = makeMockFetch(envelope({
    items: [],
    pagination: { page: 1, page_size: 50, items: 0, total: 0 },
  }));
  const client = makeClient(fetch);
  for await (const _ of client.cdn.storage.listAll()) {}
  assert.equal(new URL(calls[0].input).searchParams.get('page_size'), '50');
});

test('cdn.storage.listAll stops when pagination has no items count and resp.length < page_size', async () => {
  const mockFetch = async () => new Response(
      JSON.stringify(envelope({ items: [{ id: 's1' }], pagination: { page: 1, page_size: 5 } })),
      { status: 200, headers: { 'content-type': 'application/json' } },
  );
  const client = makeClient(mockFetch);
  const ids = [];
  for await (const s of client.cdn.storage.listAll({ page_size: 5 })) ids.push(s.id);
  assert.deepEqual(ids, ['s1']);
});

test('cdn.storage.create POSTs body and returns storage from payload', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ storage: { id: 's99', name: 'new-storage' } }));
  const client = makeClient(fetch);
  const storage = await client.cdn.storage.createCdnStorage({ name: 'new-storage' });
  assert.equal(storage.id, 's99');
  assert.equal(storage.name, 'new-storage');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/storage');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(JSON.parse(calls[0].init.body).name, 'new-storage');
});

test('cdn.storage.create throws TypeError when name exceeds 255 characters', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.cdn.storage.createCdnStorage({ name: 'a'.repeat(256) }),
      (err) => err instanceof TypeError && err.message.includes('name'),
  );
});

test('cdn.storage.create does not throw when name is exactly 255 characters', async () => {
  const { fetch } = makeMockFetch(envelope({ storage: { id: 's1', name: 'a'.repeat(255) } }), { status: 201 });
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.cdn.storage.createCdnStorage({ name: 'a'.repeat(255) }));
});

test('cdn.storage.delete DELETEs storage without body and returns SuccessResponse', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ result: { message: 'deleted' } }), { status: 200 });
  const client = makeClient(fetch);
  const result = await client.cdn.storage.deleteCdnStorage({ storage_id: 's1' });
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/storage/s1');
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(result.message, 'deleted');
});

test('cdn.storage.refresh POSTs refresh endpoint without body and returns SyncStatus', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ sync: { status: 'queued' } }));
  const client = makeClient(fetch);
  const result = await client.cdn.storage.refreshCdnStorage({ storage_id: 's1' });
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/storage/s1/refresh');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, undefined);
  assert.equal(result.status, 'queued');
});

test('cdn.storage.getUser returns user from payload', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ user: { username: 'u', password: 'p' } }));
  const client = makeClient(fetch);
  const user = await client.cdn.storage.getCdnStorageUser({ storage_id: 's1' });
  assert.equal(user.username, 'u');
  assert.equal(user.password, 'p');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/storage/s1/user');
  assert.equal(calls[0].init.method, 'GET');
});

test('validation: cdn.storage.delete throws TypeError when storage_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.cdn.storage.deleteCdnStorage({ storage_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('storage_id'),
  );
});

test('validation: cdn.storage.refresh throws TypeError when storage_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.cdn.storage.refreshCdnStorage({ storage_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('storage_id'),
  );
});

test('validation: cdn.storage.getUser throws TypeError when storage_id is empty', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.throws(
      () => client.cdn.storage.getCdnStorageUser({ storage_id: '' }),
      (err) => err instanceof TypeError && err.message.includes('storage_id'),
  );
});

test('cdn.users.create POSTs body and returns user from payload', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ user: { username: 'u', password: 'p', storage_id: 's1' } }));
  const client = makeClient(fetch);
  const user = await client.cdn.users.createCdnUser({ storage_id: 's1' });
  assert.equal(user.username, 'u');
  assert.equal(user.storage_id, 's1');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/user');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(JSON.parse(calls[0].init.body).storage_id, 's1');
});

test('cdn.users.revoke POSTs to revoke endpoint and returns user from payload', async () => {
  const { fetch, calls } = makeMockFetch(envelope({ user: { username: 'u2', password: 'p2' } }));
  const client = makeClient(fetch);
  const user = await client.cdn.users.revokeCdnUser({ username: 'u1' });
  assert.equal(user.username, 'u2');
  assert.equal(new URL(calls[0].input).pathname, '/public/v1/cdn/user/u1/revoke');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, undefined);
});

test('cdn.users.revoke throws TypeError when username is empty', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.cdn.users.revokeCdnUser({ username: '' }),
      (err) => err instanceof TypeError && err.message.includes('username'),
  );
});

test('cdn.users.revoke throws TypeError when username is whitespace-only', async () => {
  const client = makeClient(makeMockFetch().fetch);
  await assert.rejects(
      async () => client.cdn.users.revokeCdnUser({ username: '   ' }),
      (err) => err instanceof TypeError && err.message.includes('username'),
  );
});

test('resource typing: domains, accounts, cdn are accessible on client', () => {
  const client = makeClient(makeMockFetch().fetch);
  assert.ok(client.domains);
  assert.ok(client.accounts);
  assert.ok(client.cdn);
  assert.ok(client.domains.domainRecords);
  assert.ok(client.accounts.firewallRules);
  assert.ok(client.cdn.storage);
});

test('errorFromResponse: 400 → BadRequestError, not retryable', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'bad input', type: 'validation_error' } }, { status: 400 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof BadRequestError);
    assert.equal(err.status, 400);
    assert.equal(err.message, 'bad input');
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 401 → AuthenticationError, not retryable', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'unauthorized' } }, { status: 401 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof AuthenticationError);
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 403 → PermissionDeniedError, not retryable', async () => {
  const { fetch } = makeMockFetch({}, { status: 403 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof PermissionDeniedError);
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 404 → NotFoundError, not retryable', async () => {
  const { fetch } = makeMockFetch({}, { status: 404 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof NotFoundError);
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 409 → ConflictError, not retryable', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'already exists', type: 'conflict' } }, { status: 409 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof ConflictError);
    assert.equal(err.message, 'already exists');
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 422 → UnprocessableEntityError, not retryable', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'validation failed', type: 'validation_error' } }, { status: 422 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof UnprocessableEntityError);
    assert.equal(err.message, 'validation failed');
    assert.equal(err.isRetryable(), false);
    return true;
  });
});

test('errorFromResponse: 429 → RateLimitError, retryable, retryAfter from delta-seconds', async () => {
  const mockFetch = async () => new Response(
      JSON.stringify({ error: { message: 'rate limited' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30' } },
  );
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.isRetryable(), true);
    assert.equal(err.retryAfter, 30);
    return true;
  });
});

test('errorFromResponse: 429 → RateLimitError, retryAfter from HTTP-date (future)', async () => {
  const futureDate = new Date(Date.now() + 60_000).toUTCString();
  const mockFetch = async () => new Response(
      JSON.stringify({ error: { message: 'rate limited' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': futureDate } },
  );
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.ok(err.retryAfter !== null && err.retryAfter > 0);
    return true;
  });
});

test('errorFromResponse: 429 → RateLimitError, retryAfter=0 for past HTTP-date', async () => {
  const pastDate = new Date(Date.now() - 60_000).toUTCString();
  const mockFetch = async () => new Response(
      JSON.stringify({ error: { message: 'rate limited' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': pastDate } },
  );
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, 0);
    return true;
  });
});

test('errorFromResponse: 429 → RateLimitError, retryAfter null for invalid Retry-After value', async () => {
  const mockFetch = async () => new Response(
      JSON.stringify({ error: { message: 'rate limited' } }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': 'not-a-date-or-number' } },
  );
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, null);
    return true;
  });
});

test('errorFromResponse: 429 → RateLimitError, retryAfter null when header absent', async () => {
  const { fetch } = makeMockFetch({}, { status: 429 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, null);
    return true;
  });
});

test('errorFromResponse: 500 → InternalServerError, retryable', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'internal error', type: 'server_error' } }, { status: 500 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof InternalServerError);
    assert.equal(err.isRetryable(), true);
    return true;
  });
});

test('errorFromResponse: 503 → InternalServerError, retryable', async () => {
  const { fetch } = makeMockFetch({}, { status: 503 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof InternalServerError);
    assert.equal(err.isRetryable(), true);
    return true;
  });
});

test('errorFromResponse: message fallback to status when body is empty', async () => {
  const { fetch } = makeMockFetch({}, { status: 502 });
  const client = makeClient(fetch);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err.message.includes('502'));
    return true;
  });
});

test('extractMessage: plain string body is used as error message', async () => {
  const mockFetch = async () => new Response('plain error text', { status: 400, headers: { 'content-type': 'text/plain' } });
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: mockFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof BadRequestError);
    assert.equal(err.message, 'plain error text');
    return true;
  });
});

test('APIConnectionError is always retryable', () => {
  const err = new APIConnectionError('network failure', new Error('ECONNREFUSED'));
  assert.equal(err.isRetryable(), true);
  assert.ok(err.cause instanceof Error);
});

test('wrapFetchError: AbortError → APIConnectionError with aborted message', async () => {
  const hangingFetch = () => { throw new DOMException('aborted', 'AbortError'); };
  const client = new Trafficmind({ baseURL: 'http://localhost', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, timeout: 0, fetch: hangingFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof APIConnectionError);
    assert.ok(err.message.includes('aborted'));
    return true;
  });
});

test('wrapFetchError: TimeoutError → APIConnectionError with timed out message', async () => {
  const hangingFetch = () => { throw new DOMException('The operation timed out.', 'TimeoutError'); };
  const client = new Trafficmind({ baseURL: 'http://localhost', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, timeout: 0, fetch: hangingFetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof APIConnectionError);
    assert.ok(err.message.includes('timed out'));
    return true;
  });
});

test('retry: retries on 500 and throws after maxRetries exhausted', async () => {
  const { fetch, calls } = makeMockFetch({ error: { message: 'server error', type: 'server_error' } }, { status: 500 });
  const client = makeClientWithRetries(fetch, 2);
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof InternalServerError);
    return true;
  });
  assert.equal(calls.length, 3);
});

test('retry: retries on 429 and succeeds on recovery', async () => {
  let i = 0;
  const responses = [
    new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429, headers: { 'content-type': 'application/json' } }),
    new Response(JSON.stringify(envelope({ domain: { id: 'domain-1' } })), { status: 200, headers: { 'content-type': 'application/json' } }),
  ];
  const calls = [];
  const mixedFetch = async (input, init) => { calls.push({ input: String(input), init }); return responses[i++] ?? responses.at(-1); };
  const client = makeClientWithRetries(mixedFetch, 2);
  const domain = await client.domains.getDomain({ domain_id: 'domain-1' });
  assert.equal(domain.id, 'domain-1');
  assert.equal(calls.length, 2);
});

test('retry: respects Retry-After header delay', async () => {
  let i = 0;
  const responses = [
    new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '0' } }),
    new Response(JSON.stringify(envelope({ domain: { id: 'z1' } })), { status: 200, headers: { 'content-type': 'application/json' } }),
  ];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 1, fetch: async () => responses[i++] ?? responses.at(-1) });
  const domain = await client.domains.getDomain({ domain_id: 'z1' });
  assert.equal(domain.id, 'z1');
});

test('retry: maxRetries:0 disables retry, throws immediately on 500', async () => {
  const { fetch, calls } = makeMockFetch({ error: { message: 'error', type: 'server_error' } }, { status: 500 });
  const client = makeClientWithRetries(fetch, 0);
  await assert.rejects(() => client.get('/x'), (err) => { assert.ok(err instanceof InternalServerError); return true; });
  assert.equal(calls.length, 1);
});

test('retry: does not retry on 404', async () => {
  const { fetch, calls } = makeMockFetch({ error: { message: 'not found', type: 'not_found' } }, { status: 404 });
  const client = makeClientWithRetries(fetch, 2);
  await assert.rejects(() => client.get('/x'), (err) => { assert.ok(err instanceof NotFoundError); return true; });
  assert.equal(calls.length, 1);
});

test('retry: does not retry on 401', async () => {
  const { fetch, calls } = makeMockFetch({}, { status: 401 });
  const client = makeClientWithRetries(fetch, 2);
  await assert.rejects(() => client.get('/x'), () => true);
  assert.equal(calls.length, 1);
});

test('retry: retries on network failure (APIConnectionError)', async () => {
  let attempt = 0;
  const flakyFetch = async () => {
    attempt++;
    if (attempt < 3) throw new TypeError('fetch failed');
    return new Response(JSON.stringify(envelope({ items: [] })), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = makeClientWithRetries(flakyFetch, 2);
  await client.domains.listDomains();
  assert.equal(attempt, 3);
});

test('timeout: request aborts after client timeout is exceeded', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), 50);
  const hangingFetch = (_url, init) => new Promise((_res, reject) => {
    init?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('The operation was aborted.', 'AbortError')); });
  });
  const client = new Trafficmind({ baseURL: 'http://localhost', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, timeout: 0, fetch: hangingFetch });
  await assert.rejects(
      () => client.get('/x', { signal: controller.signal }),
      (err) => { assert.ok(err instanceof APIConnectionError); return true; },
  );
});

test('timeout: timeout:0 disables timeout', { timeout: 2000 }, async () => {
  const { fetch } = makeMockFetch(envelope({ items: [] }));
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', timeout: 0, fetch });
  await assert.doesNotReject(() => client.domains.listDomains());
});

test('timeout: per-request signal aborts request', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  const hangingFetch = (_url, init) => new Promise((_res, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });
  const client = new Trafficmind({ baseURL: 'http://localhost', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, timeout: 0, fetch: hangingFetch });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(
      () => client.get('/x', { signal: controller.signal }),
      (err) => { assert.ok(err instanceof APIConnectionError); return true; },
  );
});

test('timeout: both timeout and signal present uses AbortSignal.any', { timeout: 2000 }, async () => {
  const controller = new AbortController();
  const hangingFetch = (_url, init) => new Promise((_res, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
  const client = new Trafficmind({ baseURL: 'http://localhost', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, timeout: 5000, fetch: hangingFetch });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(
      () => client.get('/x', { signal: controller.signal }),
      (err) => err instanceof APIConnectionError,
  );
});

test('errorFromResponse: unrecognised 4xx → generic APIError', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'gone' } }, { status: 410 });
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch });
  await assert.rejects(() => client.get('/x'), (err) => {
    assert.ok(err instanceof APIError);
    assert.equal(err.status, 410);
    assert.equal(err.message, 'gone');
    return true;
  });
});

test('APIPromise: _thenUnwrapWithMeta propagates rejection on network failure', async () => {
  const throwingFetch = async () => { throw new TypeError('fetch failed'); };
  const badClient = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: throwingFetch });
  const err = await badClient.domains.getDomain({ domain_id: 'z1' }).catch((e) => e);
  assert.ok(err instanceof APIConnectionError);
});

test('APIPromise: .catch() handles rejection', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'not found' } }, { status: 404 });
  const client = makeClient(fetch);
  const caught = await client.get('/x').catch((err) => err);
  assert.ok(caught instanceof NotFoundError);
});

test('APIPromise: .catch() with null onrejected is a no-op', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.get('/x').catch(null));
});

test('APIPromise: .finally() is called on success', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  let finallyCalled = false;
  await client.get('/x').finally(() => { finallyCalled = true; });
  assert.ok(finallyCalled);
});

test('APIPromise: .finally() is called on rejection', async () => {
  const { fetch } = makeMockFetch({}, { status: 500 });
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch });
  let finallyCalled = false;
  await client.get('/x').finally(() => { finallyCalled = true; }).catch(() => {});
  assert.ok(finallyCalled);
});

test('APIPromise: .finally(null) is a no-op', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.get('/x').finally(null));
});

test('APIPromise: .then() with null handlers resolves normally', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  await assert.doesNotReject(() => client.get('/x').then(null, null));
});

test('APIPromise: .asResponse() returns raw Response object', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  const res = await client.get('/x').asResponse();
  assert.ok(res instanceof Response);
  assert.equal(res.status, 200);
});

test('hook: onRequest is called with request event', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const events = [];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', fetch, onRequest: (e) => events.push(e) });
  await client.get('/public/v1/domains');
  const reqEvent = events.find((e) => e.type === 'request');
  assert.ok(reqEvent);
  assert.equal(reqEvent.method, 'GET');
  assert.ok(reqEvent.url.includes('/public/v1/domains'));
  assert.equal(reqEvent.attempt, 0);
});

test('hook: onRequest is called with response event', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const events = [];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', fetch, onRequest: (e) => events.push(e) });
  await client.get('/public/v1/domains');
  const resEvent = events.find((e) => e.type === 'response');
  assert.ok(resEvent);
  assert.equal(resEvent.status, 200);
  assert.ok(typeof resEvent.durationMs === 'number');
});

test('hook: onRequest is called with error event on HTTP error', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'not found' } }, { status: 404 });
  const events = [];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch, onRequest: (e) => events.push(e) });
  await assert.rejects(() => client.get('/public/v1/domains'));
  const errEvent = events.find((e) => e.type === 'error');
  assert.ok(errEvent);
  assert.ok(errEvent.error instanceof APIError);
});

test('hook: onRequest is called with error event on network failure', async () => {
  const events = [];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 0, fetch: async () => { throw new TypeError('fetch failed'); }, onRequest: (e) => events.push(e) });
  await assert.rejects(() => client.get('/x'));
  const errEvent = events.find((e) => e.type === 'error');
  assert.ok(errEvent);
  assert.ok(errEvent.error instanceof APIConnectionError);
});

test('hook: attempt increments on retry', async () => {
  let call = 0;
  const sequencedFetch = async () => {
    call++;
    const status = call <= 3 ? 500 : 200;
    return new Response(JSON.stringify({ error: { message: 'server error' } }), { status, headers: { 'content-type': 'application/json' } });
  };
  const events = [];
  const client = new Trafficmind({ baseURL: 'https://api.trafficmind.com', accessUser: 'a@example.com', accessKey: 'k', maxRetries: 2, fetch: sequencedFetch, onRequest: (e) => events.push(e) });
  await assert.rejects(() => client.get('/x'));
  const attempts = events.filter((e) => e.type === 'request').map((e) => e.attempt);
  assert.deepEqual(attempts, [0, 1, 2]);
});

test('APIPromise: .withMeta() returns data, meta and status on domains.get', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'd1', name: 'example.com' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.getDomain({ domain_id: 'd1' }).withMeta();
  assert.equal(data.id, 'd1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(meta.timestamp, '2026-01-01T00:00:00Z');
  assert.equal(status.code, 'ok');
  assert.equal(status.message, 'Request processed successfully');
});

test('APIPromise: .withMeta() does not affect plain await on domains.get', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'd2', name: 'test.com' } }));
  const client = makeClient(fetch);
  const domain = await client.domains.getDomain({ domain_id: 'd2' });
  assert.equal(domain.id, 'd2');
  assert.equal(domain.name, 'test.com');
});

test('APIPromise: .withMeta() works on domains.create', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'new1', name: 'new.com' } }), { status: 201 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.createDomain({ name: 'new.com' }).withMeta();
  assert.equal(data.id, 'new1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domains.delete', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'del1' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.deleteDomain({ domain_id: 'del1' }).withMeta();
  assert.equal(data.id, 'del1');
  assert.ok(meta.request_id);
  assert.ok(status.code);
});

test('APIPromise: .withMeta() works on domains.list', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [{ id: 'd1' }, { id: 'd2' }], pagination: { total: 2, page: 1, page_size: 50, items: 2 } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.listDomains().withMeta();
  assert.equal(data.length, 2);
  assert.equal(data[0].id, 'd1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domainRecords.list', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [{ id: 'r1', type: 'A' }], pagination: { total: 1, page: 1, page_size: 50, items: 1 } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.domainRecords.listDomainRecords({ domain_id: 'd1' }).withMeta();
  assert.equal(data[0].id, 'r1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domainRecords.batch', async () => {
  const { fetch } = makeMockFetch(envelope({ batch: { creates: [{ id: 'r1', type: 'A', name: 'test', content: '1.1.1.1' }] } }), { status: 200 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.domainRecords.batchDomainRecords({
    domain_id: 'd1',
    body: { creates: [{ type: 'A', name: 'test', content: '1.1.1.1' }] },
  }).withMeta();
  assert.equal(data.creates[0].id, 'r1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domains.settings.get', async () => {
  const { fetch } = makeMockFetch(envelope({ setting: { id: 'ssl', value: 'full' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.settings.getDomainSetting({ domain_id: 'd1', setting_id: 'ssl' }).withMeta();
  assert.equal(data.id, 'ssl');
  assert.equal(data.value, 'full');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domains.settings.update', async () => {
  const { fetch } = makeMockFetch(envelope({ setting: { id: 'ssl', value: 'strict' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.settings.updateDomainSetting({
    domain_id: 'd1',
    setting_id: 'ssl',
    body: { value: 'strict' },
  }).withMeta();
  assert.equal(data.value, 'strict');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on domains.firewallRules.create', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.domains.firewallRules.createDomainFirewallRule({
    domain_id: 'd1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'block' },
  }).withMeta();
  assert.equal(data.acknowledged, true);
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on accounts.firewallRules.create', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.accounts.firewallRules.createAccountFirewallRule({
    account_id: 'acc1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'block' },
  }).withMeta();
  assert.equal(data.acknowledged, true);
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.storage.list', async () => {
  const { fetch } = makeMockFetch(envelope({ items: [{ id: 's1', name: 'my-storage' }], pagination: { total: 1, page: 1, page_size: 50, items: 1 } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.storage.listCdnStorages().withMeta();
  assert.equal(data[0].id, 's1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.storage.create', async () => {
  const { fetch } = makeMockFetch(envelope({ storage: { id: 's2', name: 'new-storage' } }), { status: 201 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.storage.createCdnStorage({ name: 'new-storage' }).withMeta();
  assert.equal(data.id, 's2');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.storage.delete', async () => {
  const { fetch } = makeMockFetch(envelope({ result: { message: 'deleted' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.storage.deleteCdnStorage({ storage_id: 's1' }).withMeta();
  assert.ok(data);
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.storage.refresh', async () => {
  const { fetch } = makeMockFetch(envelope({ sync: { status: 'in_progress' } }), { status: 202 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.storage.refreshCdnStorage({ storage_id: 's1' }).withMeta();
  assert.equal(data.status, 'in_progress');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.storage.getUser', async () => {
  const { fetch } = makeMockFetch(envelope({ user: { username: 'u1', sftp_host: 'sftp.example.com', sftp_port: 22 } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.storage.getCdnStorageUser({ storage_id: 's1' }).withMeta();
  assert.equal(data.username, 'u1');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.users.create', async () => {
  const { fetch } = makeMockFetch(envelope({ user: { username: 'u2', storage_id: 's1' } }), { status: 201 });
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.users.createCdnUser({ storage_id: 's1' }).withMeta();
  assert.equal(data.username, 'u2');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() works on cdn.users.revoke', async () => {
  const { fetch } = makeMockFetch(envelope({ user: { username: 'u2', storage_id: 's1' } }));
  const client = makeClient(fetch);
  const { data, meta, status } = await client.cdn.users.revokeCdnUser({ username: 'u2' }).withMeta();
  assert.equal(data.username, 'u2');
  assert.equal(meta.request_id, 'test-req-id');
  assert.equal(status.code, 'ok');
});

test('APIPromise: .withMeta() exposes httpStatus 200 for GET requests', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'd1' } }), { status: 200 });
  const client = makeClient(fetch);
  const { httpStatus } = await client.domains.getDomain({ domain_id: 'd1' }).withMeta();
  assert.equal(httpStatus, 200);
});

test('APIPromise: .withMeta() exposes httpStatus 201 for domains.create', async () => {
  const { fetch } = makeMockFetch(envelope({ domain: { id: 'new1', name: 'new.com' } }), { status: 201 });
  const client = makeClient(fetch);
  const { httpStatus } = await client.domains.createDomain({ name: 'new.com' }).withMeta();
  assert.equal(httpStatus, 201);
});

test('APIPromise: .withMeta() exposes httpStatus 201 for cdn.storage.create', async () => {
  const { fetch } = makeMockFetch(envelope({ storage: { id: 's1', name: 'test' } }), { status: 201 });
  const client = makeClient(fetch);
  const { httpStatus } = await client.cdn.storage.createCdnStorage({ name: 'test' }).withMeta();
  assert.equal(httpStatus, 201);
});

test('APIPromise: .withMeta() exposes httpStatus 201 for domains.firewallRules.create', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const { httpStatus } = await client.domains.firewallRules.createDomainFirewallRule({
    domain_id: 'd1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'block' },
  }).withMeta();
  assert.equal(httpStatus, 201);
});

test('APIPromise: .withMeta() exposes httpStatus 201 for accounts.firewallRules.create', async () => {
  const { fetch } = makeMockFetch(envelope({ acknowledged: true }), { status: 201 });
  const client = makeClient(fetch);
  const { httpStatus } = await client.accounts.firewallRules.createAccountFirewallRule({
    account_id: 'acc1',
    body: { configuration: { target: 'ip', value: '1.2.3.4' }, mode: 'block' },
  }).withMeta();
  assert.equal(httpStatus, 201);
});

test('APIPromise: .withMeta() returns undefined meta/status on raw client.get()', async () => {
  const { fetch } = makeMockFetch(envelope({}));
  const client = makeClient(fetch);
  const { meta, status, httpStatus } = await client.get('/public/v1/domains').withMeta();
  assert.equal(meta, undefined);
  assert.equal(status, undefined);
  assert.equal(httpStatus, 200);
});

test('APIPromise: .withMeta() rejects if the request fails', async () => {
  const { fetch } = makeMockFetch({ error: { message: 'not found' } }, { status: 404 });
  const client = makeClient(fetch);
  await assert.rejects(
      () => client.domains.getDomain({ domain_id: 'missing' }).withMeta(),
      (err) => err.status === 404,
  );
});