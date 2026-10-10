#!/usr/bin/env node
// Waits for the OpenShip deployment of GITHUB_SHA, then proves the backend that
// answers is the image built from that commit (its /health gitSha). The OpenShip
// commit alone is not enough: a stale pulled image would carry the old gitSha.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { releaseTarget } from '../apple-release/target.mjs';
import { waitForDeployment } from '../apple-release/deployment.mjs';

export async function waitForGitSha(apiUrl, sha, {
  request = fetch, sleep = delay, attempts = 20, intervalMs = 15000,
} = {}) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  let last = 'no response';
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await request(`${apiUrl}/health`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      const body = response.ok ? await response.json() : null;
      if (body?.gitSha === sha) return body;
      last = response.ok ? `gitSha ${body?.gitSha}` : `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    if (i < attempts - 1) await sleep(intervalMs);
  }
  throw new Error(`Running backend is not ${sha}: ${last}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sha = process.env.GITHUB_SHA;
  const target = releaseTarget(process.env.GITHUB_REF_NAME);
  const evidence = await waitForDeployment(target, sha, process.env.OPENSHIP_READ_TOKEN);
  const health = await waitForGitSha(target.apiUrl, sha);
  evidence.backendGitSha = health.gitSha;
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  console.log(`Verified ${target.profile} deployment ${evidence.deploymentId} runs ${sha}`);
}
