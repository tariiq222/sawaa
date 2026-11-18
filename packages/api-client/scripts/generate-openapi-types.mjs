#!/usr/bin/env node
/**
 * Generate `src/types/generated/openapi.ts` from the committed backend snapshot.
 *
 * This is the api-client's half of `pnpm openapi:sync`: the dashboard generates
 * its own `lib/types/api.generated.ts` from the same snapshot, and this keeps the
 * website/mobile client types on the same contract instead of hand-copied DTOs.
 *
 * The compat preload is required because openapi-typescript pulls Redocly 1.x,
 * which expects js-yaml's removed `types` export while the repo pins js-yaml 5.x.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const specPath = resolve(repoRoot, 'apps/backend/openapi.json');
const outPath = resolve(packageRoot, 'src/types/generated/openapi.ts');
const compat = resolve(repoRoot, 'apps/dashboard/scripts/js-yaml-redocly-compat.cjs');

mkdirSync(dirname(outPath), { recursive: true });

const result = spawnSync(
  process.execPath,
  [
    '--require',
    compat,
    resolve(repoRoot, 'node_modules/openapi-typescript/bin/cli.js'),
    specPath,
    '-o',
    outPath,
  ],
  { stdio: 'inherit', cwd: repoRoot },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
