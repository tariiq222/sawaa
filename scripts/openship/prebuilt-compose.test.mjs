import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derivePrebuiltCompose, SOURCE, TARGET } from './prebuilt-compose.mjs';

const sample = `services:
  postgres:
    build:
      context: ../..
      dockerfile: docker/openship/Postgres.Dockerfile
    image: \${POSTGRES_IMAGE:-sawaa-postgres:18-pgvector}
    restart: unless-stopped

  redis:
    image: redis:7-alpine

  website:
    build:
      context: ../..
      args:
        NEXT_PUBLIC_API_URL: \${NEXT_PUBLIC_API_URL:?required}

    image: \${WEBSITE_IMAGE:-sawaa-website:staging}
    mem_limit: 1536m
`;

test('removes build sections and requires image variables', () => {
  const out = derivePrebuiltCompose(sample);
  assert.doesNotMatch(out, /^ {4}build:/m);
  assert.doesNotMatch(out, /context:|dockerfile:|args:/);
  assert.match(out, /image: \$\{POSTGRES_IMAGE:\?POSTGRES_IMAGE is required\}\n {4}pull_policy: always\n {4}restart/);
  assert.match(out, /image: \$\{WEBSITE_IMAGE:\?WEBSITE_IMAGE is required\}\n {4}pull_policy: always\n {4}mem_limit/);
  assert.match(out, /redis:\n {4}image: redis:7-alpine\n/);
});

test('rejects a built service without an overridable image', () => {
  assert.throws(() => derivePrebuiltCompose('services:\n  app:\n    build: .\n    image: app:latest\n'),
    /build section|no \$\{\*_IMAGE/);
});

test('committed compose.prebuilt.yml matches compose.yml', () => {
  assert.equal(readFileSync(TARGET, 'utf8'), derivePrebuiltCompose(readFileSync(SOURCE, 'utf8')));
});
