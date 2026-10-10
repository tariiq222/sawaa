#!/usr/bin/env node
// Derives docker/openship/compose.prebuilt.yml from compose.yml.
// The derived file runs the images built by the build-images workflow, so
// OpenShip pulls them instead of building on the host. Run with --check in CI
// to fail when compose.yml changed without regenerating the derived file.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
export const SOURCE = resolve(root, 'docker/openship/compose.yml');
export const TARGET = resolve(root, 'docker/openship/compose.prebuilt.yml');

const HEADER = `# GENERATED from compose.yml by scripts/openship/prebuilt-compose.mjs. Do not edit.
# Runs prebuilt GHCR images; OpenShip pulls them and never builds on the host.
# POSTGRES_IMAGE, BACKEND_IMAGE, DASHBOARD_IMAGE and WEBSITE_IMAGE are required
# and have no defaults, so a missing value fails instead of running a stale image.
`;

const indentOf = line => line.length - line.trimStart().length;

export function derivePrebuiltCompose(source) {
  const lines = source.split('\n');
  const out = [];
  const built = new Set();
  let service = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)) service = line.trim().slice(0, -1);
    if (/^[A-Za-z]/.test(line)) service = null;
    if (service && /^ {4}build:\s*$/.test(line)) {
      built.add(service);
      while (i + 1 < lines.length && (lines[i + 1].trim() === '' || indentOf(lines[i + 1]) > 4)) i++;
      continue;
    }
    const image = /^( {4})image: \$\{([A-Z_]+_IMAGE):-[^}]+\}\s*$/.exec(line);
    if (service && built.has(service) && image) {
      out.push(`${image[1]}image: \${${image[2]}:?${image[2]} is required}`);
      out.push(`${image[1]}pull_policy: always`);
      continue;
    }
    out.push(line);
  }
  const result = HEADER + out.join('\n');
  for (const name of built) {
    if (!new RegExp(`\\n  ${name}:\\n(?: {4}.*\\n|\\n)*? {4}pull_policy: always`).test(result)) {
      throw new Error(`Service ${name} has a build section but no \${*_IMAGE:-default} image line`);
    }
  }
  if (/^ {4}build:/m.test(result)) throw new Error('A build section survived derivation');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = derivePrebuiltCompose(readFileSync(SOURCE, 'utf8'));
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(TARGET, 'utf8'); } catch {}
    if (current !== expected) {
      console.error('compose.prebuilt.yml is stale. Run: node scripts/openship/prebuilt-compose.mjs');
      process.exit(1);
    }
    console.log('compose.prebuilt.yml matches compose.yml');
  } else {
    writeFileSync(TARGET, expected);
    console.log(`Wrote ${TARGET}`);
  }
}
