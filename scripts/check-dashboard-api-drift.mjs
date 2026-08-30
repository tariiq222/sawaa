#!/usr/bin/env node
// dashboard lib/api endpoint drift check (literal method+path only).
//
// apps/dashboard/lib/api/* calls the backend through `api.get/post/put/patch/
// delete/postForm(...)`. Those strings are not generated from OpenAPI, so a
// renamed or removed backend route can ship while the dashboard still points
// at the old path (the production `Cannot POST .../collect` class of failure).
//
// This script extracts LITERAL method+path pairs from those call sites and
// requires each one to exist in the committed snapshot at
// apps/backend/openapi.json. It also hard-fails if the two canonical
// reception mutations are missing from either side:
//   POST  /api/v1/dashboard/finance/bookings/{bookingId}/collect
//   PATCH /api/v1/dashboard/bookings/{id}/restore-no-show
//
// Parser limitations (documented to avoid false confidence):
//   - Only the first argument of `api.<method>(...)` is considered, and only
//     when it is a string literal or a template literal.
//   - Template interpolations become `{}` when they look like a path param
//     (`${id}`). Interpolations that build a query string (contain `?` or a
//     nested quote/template) are dropped so `/dashboard/stats${qs ? ...}`
//     compares as `/dashboard/stats`.
//   - Dynamic paths (`api.get(endpoint)`, concatenation, path builders) are
//     skipped — they are NOT proven present in the spec.
//   - `fetch('/api/proxy/...')`, `@sawaa/api-client` `authApi.*`, hooks, and
//     components are not scanned.
//   - Request/response shapes are not checked; this is path+method existence
//     only, matching scripts/check-api-client-drift.mjs.
//
// Usage: node scripts/check-dashboard-api-drift.mjs   (run from anywhere)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(root, 'apps', 'backend', 'openapi.json');
const API_DIR = path.join(root, 'apps', 'dashboard', 'lib', 'api');

const HTTP_METHODS = new Set(['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE']);

const CANONICAL_ROUTES = [
  {
    method: 'POST',
    path: '/api/v1/dashboard/finance/bookings/{bookingId}/collect',
  },
  {
    method: 'PATCH',
    path: '/api/v1/dashboard/bookings/{id}/restore-no-show',
  },
];

function fail(message) {
  console.error(`dashboard API drift check: FAILED\n${message}`);
  process.exit(1);
}

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found at ${path.relative(root, filePath)}. Run 'pnpm openapi:sync' to regenerate it.`);
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

function normalizeClientPath(raw) {
  let p = raw.trim();
  p = p.split('?')[0];
  p = p.replace(/\/+$/, '') || '/';
  if (!p.startsWith('/')) return null;
  if (p.startsWith('/api/proxy/')) p = p.slice('/api/proxy'.length);
  if (!p.startsWith('/api/v1')) p = '/api/v1' + p;
  return p;
}

function skipBalancedBrace(src, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  let inStr = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (inStr === '"' || inStr === "'") {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (inStr === '`') {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { inStr = null; i += 1; continue; }
      if (c === '$' && src[i + 1] === '{') {
        i = skipBalancedBrace(src, i + 1) + 1;
        continue;
      }
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i += 1; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  return i - 1;
}

function readStringLiteral(src, start) {
  const q = src[start];
  if (q === '"' || q === "'") {
    let i = start + 1;
    let out = '';
    while (i < src.length) {
      if (src[i] === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (src[i] === q) return { value: out, end: i + 1, ok: true };
      out += src[i];
      i += 1;
    }
    return { value: out, end: i, ok: false };
  }
  if (q !== '`') return { value: '', end: start, ok: false };

  let i = start + 1;
  let out = '';
  while (i < src.length) {
    if (src[i] === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
    if (src[i] === '`') return { value: out, end: i + 1, ok: true };
    if (src[i] === '$' && src[i + 1] === '{') {
      const close = skipBalancedBrace(src, i + 1);
      const expr = src.slice(i + 2, close);
      // Query-string / nested-template interpolations are dropped; simple
      // path params become `{}`. See file-level parser limitations.
      if (!/[?'"`]/.test(expr)) out += '{}';
      i = close + 1;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return { value: out, end: i, ok: false };
}

function extractApiCalls(src, relFile) {
  const calls = [];
  const methodRe = /\bapi\.(get|post|put|patch|delete|postForm)\s*(?:<[^>]*>)?\s*\(/g;
  let match;
  while ((match = methodRe.exec(src))) {
    const method = match[1] === 'postForm' ? 'POST' : match[1].toUpperCase();
    let i = match.index + match[0].length;
    while (i < src.length && /\s/.test(src[i])) i += 1;
    const quote = src[i];
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      continue;
    }
    const lit = readStringLiteral(src, i);
    if (!lit.ok) continue;
    const normalized = normalizeClientPath(lit.value);
    if (!normalized) continue;
    calls.push({
      method,
      path: normalized,
      key: `${method} ${normalizePath(normalized)}`,
      file: relFile,
    });
    methodRe.lastIndex = lit.end;
  }
  return calls;
}

function walkTsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkTsFiles(full));
    else if (ent.isFile() && ent.name.endsWith('.ts') && !ent.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const spec = loadJson(SPEC_PATH, 'OpenAPI spec');
if (!spec || typeof spec.paths !== 'object' || spec.paths === null) {
  fail(`OpenAPI spec at ${path.relative(root, SPEC_PATH)} has no 'paths' object.`);
}

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

if (!fs.existsSync(API_DIR)) {
  fail(`Dashboard API dir not found at ${path.relative(root, API_DIR)}.`);
}

const calls = [];
for (const file of walkTsFiles(API_DIR)) {
  const src = fs.readFileSync(file, 'utf8');
  calls.push(...extractApiCalls(src, path.relative(root, file)));
}

if (calls.length === 0) {
  fail(`No literal api.<method>(...) calls found under ${path.relative(root, API_DIR)}. Parser may have broken.`);
}

const missing = [];
const seen = new Set();
for (const call of calls) {
  if (seen.has(`${call.key} ${call.file}`)) continue;
  seen.add(`${call.key} ${call.file}`);
  if (!specKeys.has(call.key)) {
    missing.push(`  ${call.method} ${call.path}   [${call.file}]`);
  }
}

if (missing.length > 0) {
  fail(
    `${missing.length} literal dashboard API call(s) do not exist in apps/backend/openapi.json:\n` +
    `${missing.join('\n')}\n` +
    `Either the backend route was renamed/removed (update apps/dashboard/lib/api/*) ` +
    `or the OpenAPI snapshot is stale. If the backend changed recently, run 'pnpm openapi:sync' ` +
    `and commit the snapshot.`,
  );
}

const dashboardKeys = new Set(calls.map((c) => c.key));
const canonicalMissing = [];
for (const route of CANONICAL_ROUTES) {
  const key = `${route.method} ${normalizePath(route.path)}`;
  if (!specKeys.has(key)) {
    canonicalMissing.push(`  ${route.method} ${route.path}  (missing from OpenAPI spec)`);
  }
  if (!dashboardKeys.has(key)) {
    canonicalMissing.push(`  ${route.method} ${route.path}  (no literal call in apps/dashboard/lib/api)`);
  }
}

if (canonicalMissing.length > 0) {
  fail(
    `Canonical collect / restore-no-show route detection failed:\n` +
    `${canonicalMissing.join('\n')}\n` +
    `These routes must exist in apps/backend/openapi.json and be called from apps/dashboard/lib/api.`,
  );
}

console.log(
  `dashboard API drift check: ${calls.length} literal call(s) verified against the spec; ` +
  `canonical POST collect and PATCH restore-no-show detected.`,
);
