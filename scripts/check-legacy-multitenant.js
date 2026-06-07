#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ignoredDirs = new Set([
  '.git',
  '.turbo',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
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
