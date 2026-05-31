/**
 * Fetches the OpenAPI spec from the running backend (http://localhost:5200)
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

const API_BASE = process.env.API_URL ?? 'http://localhost:5200';
const SPEC_URL = `${API_BASE}/api/docs-json`;
const OUT_PATH = resolve(__dirname, '../openapi.json');

async function main(): Promise<void> {
  console.log(`Fetching OpenAPI spec from ${SPEC_URL} ...`);

  const res = await fetch(SPEC_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec: ${res.status} ${res.statusText}\nIs the backend running on ${API_BASE}?`);
  }

  const spec = await res.json();
  // Deterministic key order so git diffs stay readable AND so this output
  // byte-matches the committed snapshot produced by the WRITE_OPENAPI_SPEC
  // path in src/main.ts. Both must use the IDENTICAL recursive sort, otherwise
  // the CI drift gate can never match. JSON.stringify's replacer cannot do this
  // (arrays act as a global property allowlist and drop nested keys), so we walk
  // the tree ourselves.
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortKeys((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  };
  writeFileSync(OUT_PATH, JSON.stringify(sortKeys(spec), null, 2), 'utf-8');
  console.log(`✓ OpenAPI spec written to ${OUT_PATH}`);
}

void main().catch((err) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
