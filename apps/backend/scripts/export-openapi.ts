/**
 * Fetches the OpenAPI spec from the running backend (http://localhost:5100)
 * and writes it to openapi.json.
 *
 * Prerequisite: backend must be running (`npm run dev:backend` or docker stack).
 *
 * Usage:
 *   npm run openapi:export          (from apps/backend)
 *   npm run openapi:sync            (from monorepo root — export + generate)
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const API_BASE = process.env.API_URL ?? 'http://localhost:5100';
const SPEC_URL = `${API_BASE}/api/docs-json`;
const OUT_PATH = resolve(__dirname, '../openapi.json');

async function main(): Promise<void> {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL} ...`);

  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}\nIs the backend running on ${API_BASE}?`);
  }

  const spec = await res.json();
  writeFileSync(OUT_PATH, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`✓ OpenAPI spec written to ${OUT_PATH}`);
}

void main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
