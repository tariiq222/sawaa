#!/usr/bin/env node
// api-client endpoint drift check (phase 1: path+method existence only).
//
// packages/api-client is HAND-WRITTEN (not generated), so nothing rebuilds it
// when a backend route is renamed or removed. This script cross-checks the
// endpoints the client calls — enumerated in
// packages/api-client/endpoints.manifest.json — against the committed OpenAPI
// snapshot at apps/backend/openapi.json, and fails when a manifest entry's
// method+path no longer exists in the spec.
//
// Maintenance: when you add/change/remove an endpoint call in
// packages/api-client/src/modules/*, update endpoints.manifest.json in the
// same commit. Paths use the OpenAPI format (full /api/v1 prefix, {param}
// placeholders). Param NAMES don't have to match the spec — `{id}` vs
// `{bookingId}` compare equal — but every literal segment must.
//
// Usage: node scripts/check-api-client-drift.mjs   (run from anywhere)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(root, 'apps', 'backend', 'openapi.json');
const MANIFEST_PATH = path.join(root, 'packages', 'api-client', 'endpoints.manifest.json');
const MODULES_DIR = path.join(root, 'packages', 'api-client', 'src', 'modules');

const HTTP_METHODS = new Set(['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE']);

function fail(message) {
  console.error(`api-client drift check: FAILED\n${message}`);
  process.exit(1);
}

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found at ${path.relative(root, filePath)}. ` +
      (label === 'OpenAPI spec'
        ? `Run 'pnpm openapi:sync' to regenerate it.`
        : `It must list every endpoint packages/api-client calls.`));
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`${label} at ${path.relative(root, filePath)} is not valid JSON: ${err.message}`);
  }
}

// `/a/{bookingId}/cancel` → `/a/{}/cancel` so param names never cause false drift.
function normalizePath(p) {
  return p.replace(/\{[^}]*\}/g, '{}');
}

const spec = loadJson(SPEC_PATH, 'OpenAPI spec');
const manifest = loadJson(MANIFEST_PATH, 'api-client endpoint manifest');

if (!spec || typeof spec.paths !== 'object' || spec.paths === null) {
  fail(`OpenAPI spec at ${path.relative(root, SPEC_PATH)} has no 'paths' object.`);
}
if (!Array.isArray(manifest) || manifest.length === 0) {
  fail(`Manifest at ${path.relative(root, MANIFEST_PATH)} must be a non-empty array of { "method", "path" } entries.`);
}

// Build the set of "METHOD /normalized/path" keys the backend actually serves.
const specKeys = new Set();
for (const [specPath, operations] of Object.entries(spec.paths)) {
  for (const method of Object.keys(operations ?? {})) {
    const upper = method.toUpperCase();
    if (HTTP_METHODS.has(upper)) {
      specKeys.add(`${upper} ${normalizePath(specPath)}`);
    }
  }
}
if (specKeys.size === 0) {
  fail(`OpenAPI spec at ${path.relative(root, SPEC_PATH)} contains no operations.`);
}

const malformed = [];
const missing = [];

manifest.forEach((entry, index) => {
  if (
    !entry || typeof entry !== 'object' ||
    typeof entry.method !== 'string' || !HTTP_METHODS.has(entry.method.toUpperCase()) ||
    typeof entry.path !== 'string' || !entry.path.startsWith('/')
  ) {
    malformed.push(`  entry #${index}: ${JSON.stringify(entry)}`);
    return;
  }
  const key = `${entry.method.toUpperCase()} ${normalizePath(entry.path)}`;
  if (!specKeys.has(key)) {
    missing.push(`  ${entry.method.toUpperCase()} ${entry.path}`);
  }
});

if (malformed.length > 0) {
  fail(
    `Malformed manifest entries (need { "method": "GET", "path": "/api/v1/..." }):\n` +
    malformed.join('\n'),
  );
}

if (missing.length > 0) {
  fail(
    `${missing.length} endpoint(s) referenced by packages/api-client do not exist in apps/backend/openapi.json:\n` +
    `${missing.join('\n')}\n` +
    `Either the backend route was renamed/removed (update the api-client module AND ` +
    `packages/api-client/endpoints.manifest.json together), or the manifest entry is stale. ` +
    `If the backend changed recently, make sure 'pnpm openapi:sync' was run and the snapshot committed.`,
  );
}

// ── Reverse direction: every endpoint the api-client SOURCE calls must be
// declared in the manifest. Without this, a NEW endpoint added to
// src/modules/* silently escapes the gate (the original one-directional check
// only proved manifest entries still exist in the spec). Scan every
// apiRequest(...) call, normalize its method+path, and require a manifest entry.
function normalizeClientPath(raw) {
  let p = raw;
  p = p.replace(/\$\{qs\}/g, '');        // appended query-string builder var
  p = p.split('?')[0];                       // strip a literal query string
  p = p.replace(/\$\{[^}]*\}/g, '{}');    // path params → {}
  if (!p.startsWith('/api/v1')) p = '/api/v1' + p;
  return p;
}

const manifestKeys = new Set(
  manifest.map((e) => `${e.method.toUpperCase()} ${normalizePath(e.path)}`),
);

const APIREQUEST_RE =
  /apiRequest\s*(?:<[^>]*>)?\s*\(\s*([`'"])((?:[^`'"\\]|\\.)*)\1\s*(?:,\s*\{([\s\S]*?)\})?/g;

const undeclared = [];
if (fs.existsSync(MODULES_DIR)) {
  for (const file of fs.readdirSync(MODULES_DIR)) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
    const src = fs.readFileSync(path.join(MODULES_DIR, file), 'utf8');
    let m;
    while ((m = APIREQUEST_RE.exec(src))) {
      const opts = m[3] ?? '';
      const methodMatch = opts.match(/method:\s*[`'"]([A-Za-z]+)[`'"]/);
      const method = (methodMatch ? methodMatch[1] : 'GET').toUpperCase();
      const key = `${method} ${normalizePath(normalizeClientPath(m[2]))}`;
      if (!manifestKeys.has(key)) {
        undeclared.push(`  ${key}   [src/modules/${file}]`);
      }
    }
  }
}

if (undeclared.length > 0) {
  fail(
    `${undeclared.length} endpoint(s) CALLED by packages/api-client/src/modules are not declared in ` +
    `endpoints.manifest.json:\n${[...new Set(undeclared)].sort().join('\n')}\n` +
    `Add each to packages/api-client/endpoints.manifest.json (full /api/v1 path, {param} placeholders) ` +
    `in the same commit so the drift gate keeps covering it.`,
  );
}

console.log(
  `api-client drift check: ${manifest.length} manifest endpoints verified against the spec; ` +
  `every api-client source call is declared.`,
);
