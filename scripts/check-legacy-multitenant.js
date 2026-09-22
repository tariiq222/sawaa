#!/usr/bin/env node

/**
 * Legacy multi-tenant source guard.
 *
 * Scans product sources for banned legacy multi-tenant tokens. Two classes of
 * paths are skipped on purpose, and neither of them relaxes the rules:
 *
 *   1. dependency/build output: .git, .turbo, .next, node_modules, dist, build,
 *      coverage, test-results, playwright-report, .worktrees.
 *   2. isolated orchestration state and local tool caches, which are data
 *      output rather than product source:
 *        .agent-teams  -> Agent Teams state + archived team records. The
 *                         records are the evidence trail, so the guard must
 *                         never force them to be deleted or rewritten.
 *        .pnpm-store   -> pnpm content-addressable cache (~1.5G, ~98.6k files,
 *                         of which ~1.7k are text-extension reads) that only
 *                         slows the scan and can carry unrelated package text.
 *        .commandcode  -> local tool state.
 *        .cursor       -> local editor state.
 *
 * The same token found anywhere in apps/, packages/, scripts/ or docs/ still
 * fails the guard: those trees are never excluded, the regexes are untouched,
 * and the per-rule allowlist below is unchanged.
 *
 * Usage:
 *   node scripts/check-legacy-multitenant.js [--root <dir>]
 *
 * `--root` defaults to the repository root (parent of this script's directory)
 * and exists so regression tests can point the guard at a temporary fixture
 * repository outside the project. Exit code 1 means violations were found (or
 * the CLI was misused); exit code 0 means the scanned tree is clean.
 */

const fs = require('node:fs');
const path = require('node:path');

const usage = 'Usage: node scripts/check-legacy-multitenant.js [--root <dir>]';

const rootFlagIndex = process.argv.indexOf('--root');
const rootFlagValue = rootFlagIndex === -1 ? undefined : process.argv[rootFlagIndex + 1];
if (rootFlagIndex !== -1 && (!rootFlagValue || rootFlagValue.startsWith('-'))) {
  console.error(usage);
  process.exit(1);
}

const root = path.resolve(
  rootFlagValue === undefined ? path.join(__dirname, '..') : rootFlagValue,
);

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`${usage}\n  --root must point to an existing directory: ${root}`);
  process.exit(1);
}

const ignoredDirs = new Set([
  '.git',
  '.turbo',
  '.next',
  '.worktrees',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  // Isolated orchestration state and tool caches (see the header comment).
  '.agent-teams',
  '.pnpm-store',
  '.commandcode',
  '.cursor',
]);

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
]);

const rules = [
  {
    name: 'Do not send/read legacy X-Org-Id headers',
    pattern: /\bX-Org-Id\b|\bx-org-id\b/g,
    allow: [
      'apps/mobile/services/api.ts',
      'apps/mobile/services/api.test.ts',
      'apps/backend/src/common/guards/jwt.guard.ts',
      'scripts/check-legacy-multitenant.js',
    ],
  },
  {
    name: 'Use FeatureKey.SMS_PROVIDER_DEDICATED instead of legacy SMS_PROVIDER_PER_TENANT',
    pattern: /\bSMS_PROVIDER_PER_TENANT\b/g,
    allow: [
      'packages/shared/constants/feature-keys.ts',
      'scripts/check-legacy-multitenant.js',
    ],
  },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
      continue;
    }
    if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      files.push(absolute);
    }
  }
  return files;
}

const violations = [];

for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of rules) {
    if (rule.allow.includes(rel)) continue;
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split('\n').length;
      violations.push(`${rel}:${line} ${rule.name} (${match[0]})`);
    }
  }
}

if (violations.length > 0) {
  console.error('Legacy multi-tenant guard failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Legacy multi-tenant guard passed.');
