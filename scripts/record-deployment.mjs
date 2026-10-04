#!/usr/bin/env node
// Records an operator attestation, not live or cryptographic deployment proof.
import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync, writeFileSync } from 'node:fs';

const SERVICE_NAMES = ['backend', 'dashboard', 'website', 'postgres', 'redis', 'minio'];
const CHECK_NAMES = ['backend', 'dashboard', 'website'];
const MAX_BYTES = 64 * 1024;

function requireValid(condition) {
  if (!condition) throw new Error('Invalid evidence');
}

function readEvidence(path) {
  const fd = openSync(path, 'r');
  try {
    // Bound the read itself, including files that grow after opening.
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    requireValid(length <= MAX_BYTES);
    return buffer.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}

function normalizeEntries(entries, names, validate, normalize) {
  requireValid(Array.isArray(entries) && entries.length === names.length);
  return names.map(name => {
    const matches = entries.filter(entry => entry && entry.name === name);
    requireValid(matches.length === 1 && validate(matches[0]));
    return normalize(matches[0]);
  });
}

function createRecord(raw, now) {
  const data = JSON.parse(raw.toString('utf8'));
  requireValid(data && data.schemaVersion === 1);
  requireValid(['staging', 'production'].includes(data.environment));
  requireValid(typeof data.expectedCommit === 'string' && /^[a-f0-9]{40}$/.test(data.expectedCommit));
  requireValid(data.expectedCommit === data.deployedCommit);
  requireValid(typeof data.deploymentId === 'string' && /^dep_[A-Za-z0-9_-]+$/.test(data.deploymentId));
  requireValid(data.status === 'ready');
  requireValid(typeof data.verifiedBy === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.@+-]{0,99}$/.test(data.verifiedBy));
  const observed = Date.parse(data.observedAt);
  requireValid(typeof data.observedAt === 'string' && Number.isFinite(observed));
  requireValid(new Date(observed).toISOString() === data.observedAt);
  requireValid(observed <= now && now - observed <= 24 * 60 * 60 * 1000);

  const services = normalizeEntries(data.services, SERVICE_NAMES,
    entry => entry.health === 'healthy' && entry.deploymentId === data.deploymentId,
    entry => ({ name: entry.name, health: 'healthy', deploymentId: data.deploymentId }));
  const checks = normalizeEntries(data.checks, CHECK_NAMES,
    entry => entry.status === 200,
    entry => ({ name: entry.name, status: 200 }));

  // Explicit fields only: extra input fields may contain credentials.
  return {
    schemaVersion: 1,
    environment: data.environment,
    commit: data.expectedCommit,
    deploymentId: data.deploymentId,
    observedAt: data.observedAt,
    recordedAt: new Date(now).toISOString(),
    status: 'verified',
    evidenceSha256: createHash('sha256').update(raw).digest('hex'),
    verificationSource: 'operator-attestation',
    verifiedBy: data.verifiedBy,
    services,
    checks,
  };
}

try {
  requireValid(process.argv.length === 4);
  const raw = readEvidence(process.argv[2]);
  const record = createRecord(raw, Date.now());
  writeFileSync(process.argv[3], `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
} catch {
  // Never print input paths, parser excerpts, or provider error payloads.
  process.stderr.write('Deployment record not written: invalid evidence or unavailable output.\n');
  process.exitCode = 1;
}
