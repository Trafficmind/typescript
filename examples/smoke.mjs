import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Trafficmind from '../dist/esm/index.js';

function loadDotEnv(dotEnvPath) {
  if (!fs.existsSync(dotEnvPath)) return;
  const txt = fs.readFileSync(dotEnvPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotEnv(path.join(__dirname, '.env'));

const accessUser = process.env.TRAFFICMIND_ACCESS_USER;
const accessKey  = process.env.TRAFFICMIND_ACCESS_KEY;
const baseURL    = process.env.TRAFFICMIND_BASE_URL;

if (!accessUser || !accessKey) {
  console.error('Missing TRAFFICMIND_ACCESS_USER or TRAFFICMIND_ACCESS_KEY. Create examples/.env (see README).');
  process.exit(1);
}

const client = new Trafficmind({ accessUser: accessUser, accessKey: accessKey, ...(baseURL && { baseURL }) });

console.log(`Connecting to: ${client.baseURL}`);

const domains = await client.domains.listDomains({ page_size: 5 });
console.log(`domains.listDomains count=${domains.length}`);

const first = domains[0];
if (first?.id) {
  const z = await client.domains.getDomain({ domain_id: first.id });
  console.log(`first domain id=${z.id} name=${z.name}`);
}

console.log('OK');