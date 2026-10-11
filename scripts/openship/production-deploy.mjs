#!/usr/bin/env node
// Production publication after explicit owner acceptance and verified backup. Never migrates a database.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { waitForGitSha } from './verify-prebuilt-deploy.mjs';

export const PROJECT_ID = 'proj_tsxe0sAW3u2AMSGO';
export const APP_SERVICES = ['backend', 'dashboard', 'website'];
const INFRA_SERVICES = ['postgres', 'redis', 'minio'];
const BASE = 'https://open.webvue.pro/api/proxy';
const PREFIX = 'ghcr.io/tariiq222/sawaa';
const API = 'https://api.sawaa.sa/api/v1';

// Historical provenance, documented on 2026-10-03 and re-observed read-only on
// 2026-10-11. The running image has these same source SQL hashes. Never repair
// _prisma_migrations or edit SQL to erase this history. No other drift is allowed.
const HISTORICAL_CHECKSUMS = {
  '20260520134448_add_delivery_type_and_bundles': { database: '', source: '778c3f29ceeaa9eb69275e105b169629e4750a0717f11ab2def95023887a661f' },
  '20260520150000_finalize_delivery_type_transition': { database: '', source: '077e3320b8de354f2664555a94b63bc65567b815fde9b90d9d9b519819d30942' },
  '20260831120000_normalize_ai_provider_to_openrouter': { database: 'e53f354102abbefd20d5828c1909e9f58041a76565606a4d5b45eafc9e605aed', source: '0a5602c08b4c47c1b626ee308978f53f36f4ffdf81081c03566a2c87e8e5cbc1' },
};

export function buildImageRefs(sha, manifests) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.equal(manifests.length, APP_SERVICES.length, 'Exactly three application images are required');
  assert.deepEqual(manifests.map(m => m.service).sort(), [...APP_SERVICES].sort());
  return Object.fromEntries(manifests.map(m => {
    assert.equal(m.sha, sha, 'Image source SHA mismatch');
    assert.equal(m.environment, 'production', 'Only production images may deploy');
    assert.match(m.digest, /^sha256:[a-f0-9]{64}$/);
    return [m.service, `${PREFIX}-${m.service}@${m.digest}`];
  }));
}

export function assertProductionProject(project, sourceRef = 'main') {
  assert.equal(project.id, PROJECT_ID, 'Wrong OpenShip project');
  assert.equal(project.gitBranch, sourceRef);
  assert.equal(project.autoDeploy, false, 'Git push auto-deploy must stay disabled');
  assert.equal(project.composePath, 'docker/openship/compose.prebuilt.yml');
}

export function assertHookScope(hook, services) {
  assert.equal(hook.enabled, true);
  assert.equal(hook.requiresReauthorization, false);
  assert.equal(hook.authMode, 'token');
  assert.equal(hook.actionType, 'deploy');
  const apps = services.filter(s => s.enabled && APP_SERVICES.includes(s.name));
  assert.deepEqual(apps.map(s => s.name).sort(), [...APP_SERVICES].sort());
  assert.deepEqual([...hook.actionConfig.serviceIds].sort(), apps.map(s => s.id).sort(), 'Hook scope must be application-only');
  assert.deepEqual(apps.find(s => s.name === 'backend').commandArgv, ['node', 'dist/src/main.js'], 'Backend must not execute database migrations');
}

export function assertMigrationState(expected, rows) {
  assert.ok(expected.length > 0 && Array.isArray(rows), 'Migration metadata required');
  const applied = rows.filter(r => !r.rolled_back_at);
  assert.ok(applied.every(r => r.finished_at), 'An unfinished migration blocks publication');
  assert.deepEqual(applied.map(r => r.migration_name).sort(), expected.map(e => e.name).sort(), 'Pending or unexpected migrations; no schema changes are authorized');
  for (const e of expected) {
    const row = applied.find(r => r.migration_name === e.name);
    const historical = HISTORICAL_CHECKSUMS[e.name];
    assert.ok(row.checksum === e.checksum || (historical && row.checksum === historical.database && e.checksum === historical.source),
      `Unexpected migration checksum: ${e.name}`);
  }
}

export function assertRuntime(before, after, refs, { allowStarting = false } = {}) {
  assert.equal(after.length, 6);
  assert.equal(new Set(after.map(c => c.serviceName)).size, 6);
  assert.equal(new Set(after.map(c => c.containerId)).size, 6);
  for (const name of [...APP_SERVICES, ...INFRA_SERVICES]) {
    const c = after.find(x => x.serviceName === name);
    assert.ok(c?.containerId);
    assert.ok(c.status === 'running' || (allowStarting && APP_SERVICES.includes(name) && c.status === 'starting'), `${name} is not running`);
    assert.deepEqual(c.duplicates, []);
    if (APP_SERVICES.includes(name)) assert.equal(c.imageRef, refs[name], `${name} is running a stale image`);
    else {
      const previous = before.find(x => x.serviceName === name);
      assert.equal(c.containerId, previous?.containerId, `${name} was unexpectedly replaced`);
      assert.equal(c.imageRef, previous.imageRef);
    }
  }
  return after.every(c => c.status === 'running');
}

export async function migrationManifest(root = resolve(import.meta.dirname, '../..')) {
  const directory = resolve(root, 'apps/backend/prisma/migrations');
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(entries.filter(e => e.isDirectory()).map(async e => ({ name: e.name,
    checksum: createHash('sha256').update(await readFile(resolve(directory, e.name, 'migration.sql'))).digest('hex'),
  })));
}

// A SELECT-only transaction through the current production backend's own connection.
// No credentials, customer rows or raw errors are emitted.
const MIGRATION_READ = `const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});try{await c.connect();await c.query('BEGIN READ ONLY');const r=await c.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name');await c.query('COMMIT');console.log(JSON.stringify(r.rows));}finally{await c.end();}})().catch(()=>{console.error('Migration metadata read failed');process.exit(1);});`;
export const MIGRATION_READ_COMMAND = `node --no-warnings -e '${MIGRATION_READ.replaceAll("'", "'\\''")}'`;

export async function deployProduction({ sha, branch, enabled, manifests, hookId, writeToken, hookToken, githubToken,
  authorization, backup, stagingReadToken, now = Date.now, request = fetch, sleep = delay, migrations, attempts = 80, runtimeAttempts = 20, intervalMs = 15000, onProgress = () => {},
}) {
  assert.equal(branch, 'main', 'Only main may publish production');
  assert.equal(enabled, 'true', 'PRODUCTION_PREBUILT_DEPLOY must be true; publication is not silently skipped');
  for (const value of [writeToken, hookToken, githubToken, hookId, stagingReadToken]) assert.ok(value, 'Missing production deployment credentials');
  assert.match(hookId, /^[A-Za-z0-9_-]+$/);
  const refs = buildImageRefs(sha, manifests);
  const json = async (path, method = 'GET', body) => {
    assert.ok(path.startsWith(`/api/projects/${PROJECT_ID}`) || (method === 'GET' && path.startsWith('/api/deployments/')),
      'Request outside production scope');
    const response = await request(BASE + path, { method, headers: { Authorization: `Bearer ${writeToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(120000), redirect: 'error' });
    if (!response.ok) throw new Error(`OpenShip ${method} request failed: HTTP ${response.status}`);
    return response.json();
  };
  const assertCurrentSource = async () => {
    const response = await request('https://api.github.com/repos/tariiq222/sawaa/git/ref/heads/main', {
      headers: { Authorization: `Bearer ${githubToken}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Source check HTTP ${response.status}`);
    assert.equal((await response.json()).object?.sha, sha, 'Deployment source was superseded');
  };
  await assertCurrentSource();
  assert.ok(authorization, 'Explicit production authorization required');
  assert.match(authorization.acceptedSha, /^[a-f0-9]{40}$/);
  assert.match(authorization.releaseBranch, /^release\/\d{4}-\d{2}-\d{2}$/);
  assert.match(authorization.stagingDeploymentId, /^dep_[A-Za-z0-9_-]+$/);
  assert.ok(Number.isFinite(Date.parse(authorization.ownerAcceptedAt)), 'Owner acceptance time required');
  const github = async path => {
    const response = await request('https://api.github.com/repos/tariiq222/sawaa' + path, {
      headers: { Authorization: `Bearer ${githubToken}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Release admission HTTP ${response.status}`);
    return response.json();
  };
  const release = await github('/git/ref/heads/' + authorization.releaseBranch);
  assert.equal(release.object?.sha, authorization.acceptedSha, 'Frozen release changed');
  const mainCommit = await github('/git/commits/' + sha);
  const acceptedCommit = await github('/git/commits/' + authorization.acceptedSha);
  assert.match(acceptedCommit.tree?.sha, /^[a-f0-9]{40}$/);
  assert.equal(mainCommit.tree?.sha, acceptedCommit.tree.sha, 'Main tree differs from accepted release content');
  const stagingGet = async path => {
    const response = await request(BASE + path, { headers: { Authorization: `Bearer ${stagingReadToken}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok) throw new Error(`Accepted staging read HTTP ${response.status}`);
    return response.json();
  };
  const { data: staging } = await stagingGet('/api/projects/proj_7M0RNj59nQnafh1m');
  assert.equal(staging.id, 'proj_7M0RNj59nQnafh1m');
  assert.equal(staging.gitBranch, 'develop');
  assert.equal(staging.activeDeploymentId, authorization.stagingDeploymentId, 'Accepted staging deployment changed');
  const { data: acceptedDeployment } = await stagingGet('/api/deployments/' + authorization.stagingDeploymentId);
  assert.equal(acceptedDeployment.projectId, staging.id);
  assert.equal(acceptedDeployment.status, 'ready');
  assert.equal(acceptedDeployment.branch, authorization.acceptedSha);
  if (acceptedDeployment.commitSha != null) assert.equal(acceptedDeployment.commitSha, authorization.acceptedSha);
  await waitForGitSha('https://staging.sawaa.sa/api/v1', authorization.acceptedSha, { request, sleep, attempts: 1 });
  assertBackupEvidence(backup, now());
  const { data: project } = await json(`/api/projects/${PROJECT_ID}`);
  assertProductionProject(project);
  assert.equal(backup.deploymentId, project.activeDeploymentId, 'Backup rollback deployment changed');
  const { data: rollback } = await json(`/api/deployments/${backup.deploymentId}`);
  assert.equal(rollback.id, backup.deploymentId);
  assert.equal(rollback.projectId, PROJECT_ID);
  assert.equal(rollback.status, 'ready');
  assert.equal(rollback.commitSha ?? rollback.branch, backup.sourceSha, 'Backup rollback source changed');
  const { services } = await json(`/api/projects/${PROJECT_ID}/services`);
  const { data: hooks } = await json(`/api/projects/${PROJECT_ID}/incoming-webhooks`);
  assertHookScope(hooks.find(h => h.id === hookId), services);
  const { success, containers: before } = await json(`/api/projects/${PROJECT_ID}/services/containers`);
  assert.equal(success, true);
  const backend = services.find(s => s.name === 'backend');
  const read = await json(`/api/projects/${PROJECT_ID}/services/${backend.id}/exec`, 'POST', { command: MIGRATION_READ_COMMAND, timeoutMs: 30000 });
  const exec = read.data ?? read;
  assert.equal(exec.exitCode, 0, 'Read-only migration gate failed');
  assert.ok(!exec.truncated && !exec.timedOut, 'Incomplete migration evidence');
  const rows = JSON.parse(exec.output);
  const expectedMigrations = migrations ?? await migrationManifest();
  assertMigrationState(expectedMigrations, rows);
  await assertCurrentSource();
  const { data: environment } = await json(`/api/projects/${PROJECT_ID}/env?environment=production`);
  const previousImages = APP_SERVICES.map(name => {
    const key = `${name.toUpperCase()}_IMAGE`;
    const row = environment.find(e => e.key === key);
    assert.ok(row?.value && !row.isSecret && !row.value.includes('••'), 'Readable application image reference required');
    return { key, value: row.value, isSecret: false };
  });
  let imagePatchAttempted = false;
  let hookAttempted = false;
  let triggered;
  let publicationError;
  try {
    // GitHub content/commit APIs accept an immutable full SHA as their ref.
    // The scoped hook snapshots this ref, so a simultaneous develop push cannot
    // mix its Compose source with this workflow's previously built image set.
    await json(`/api/projects/${PROJECT_ID}/branch`, 'POST', { branch: sha });
    const { data: pinned } = await json(`/api/projects/${PROJECT_ID}`);
    assertProductionProject(pinned, sha);
    await assertCurrentSource();
    // OpenShip calls the runtime slot "production" even in the production project.
    imagePatchAttempted = true;
    await json(`/api/projects/${PROJECT_ID}/env`, 'PATCH', { environment: 'production',
      upserts: APP_SERVICES.map(name => ({ key: `${name.toUpperCase()}_IMAGE`, value: refs[name], isSecret: false })), deletes: [] });
    await assertCurrentSource();
    hookAttempted = true;
    const response = await request(`${BASE}/api/webhooks/incoming/${hookId}`, { method: 'POST',
      headers: { Authorization: `Bearer ${hookToken}` }, signal: AbortSignal.timeout(60000), redirect: 'error' });
    if (!response.ok) throw new Error(`Scoped deploy hook failed: HTTP ${response.status}`);
    ({ data: triggered } = await response.json());
    assert.equal(triggered?.action, 'deploy');
    assert.match(triggered.ref, /^dep_[A-Za-z0-9_-]+$/);
  } catch (error) { publicationError = error; } finally {
    const cleanupErrors = [];
    // Restore desired refs only when no hook was attempted. A timeout after a
    // trigger has an unknown outcome and must not race the queued snapshot.
    try {
      if (imagePatchAttempted && !hookAttempted) {
        await json(`/api/projects/${PROJECT_ID}/env`, 'PATCH', { environment: 'production', upserts: previousImages, deletes: [] });
      }
    } catch (error) { cleanupErrors.push(error); }
    // This cleanup runs independently even if image compensation failed.
    try {
      const { data: selected } = await json(`/api/projects/${PROJECT_ID}`);
      if (selected.gitBranch === sha) await json(`/api/projects/${PROJECT_ID}/branch`, 'POST', { branch: 'main' });
      else assertProductionProject(selected); // Never overwrite somebody else's ref.
    } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) throw new AggregateError([publicationError, ...cleanupErrors].filter(Boolean), 'Production publication cleanup failed; inspect configuration before retrying');
  }
  if (publicationError) throw publicationError;
  let ready;
  for (let i = 0; i < attempts; i++) {
    const { data: deployment } = await json(`/api/deployments/${triggered.ref}`);
    assert.equal(deployment.projectId, PROJECT_ID);
    assert.equal(deployment.branch, sha, 'Deployment source ref was not frozen');
    // OpenShip omits commitSha for fully image-backed snapshots because no
    // service needs Git source. The exact frozen ref is still required here;
    // digest identities and the independent live backend SHA are proved below.
    if (deployment.commitSha != null)
      assert.equal(deployment.commitSha, sha, 'Hook selected a different source');
    assert.equal(deployment.meta?.strictServiceScope, true);
    assert.deepEqual([...deployment.meta.targetServiceIds].sort(), [...hookIds(hooks, hookId)].sort());
    if (['failed', 'cancelled', 'partial_failure', 'action_required', 'rejected', 'no_changes'].includes(deployment.status))
      throw new Error(`Production deployment failed: ${deployment.status}`);
    if (deployment.status === 'ready') { ready = deployment; break; }
    if (i === attempts - 1) throw new Error('Production deployment timed out');
    onProgress(`Waiting for production deployment ${triggered.ref}: ${deployment.status}`);
    await sleep(intervalMs);
  }
  // OpenShip ready precedes Docker's first health probe. Only application
  // startup may wait; every observation still proves exact refs and preserves
  // infrastructure identities. Never record starting as successful evidence.
  assert.ok(Number.isInteger(runtimeAttempts) && runtimeAttempts > 0);
  let after;
  for (let i = 0; i < runtimeAttempts; i++) {
    const { data: current } = await json(`/api/projects/${PROJECT_ID}`);
    assertProductionProject(current);
    assert.equal(current.activeDeploymentId, ready.id);
    const { success: observed, containers } = await json(`/api/projects/${PROJECT_ID}/services/containers`);
    assert.equal(observed, true);
    if (assertRuntime(before, containers, refs, { allowStarting: true })) { after = containers; break; }
    if (i === runtimeAttempts - 1) throw new Error('Production runtime health timed out');
    onProgress(`Waiting for production application health: ${triggered.ref}`);
    await sleep(intervalMs);
  }
  assertRuntime(before, after, refs);
  const health = await waitForGitSha(API, sha, { request, sleep });
  const httpChecks = [];
  for (const url of [`${API}/health/ready`, 'https://sawaa.sa/', 'https://admin.sawaa.sa/', 'https://files.sawaa.sa/minio/health/live']) {
    const response = await request(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    assert.equal(response.status, 200, `Readiness check failed for ${new URL(url).hostname}`);
    await response.body?.cancel();
    httpChecks.push({ url, status: 200 });
  }
  const dashboard = services.find(s => s.name === 'dashboard');
  const probe = await json(`/api/projects/${PROJECT_ID}/services/${dashboard.id}/exec`, 'POST', {
    command: `node --no-warnings -e 'fetch("http://127.0.0.1:5103/",{signal:AbortSignal.timeout(10000),redirect:"error"}).then(r=>{console.log(JSON.stringify({status:r.status}));process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))'`, timeoutMs: 15000,
  });
  const dashboardProbe = probe.data ?? probe;
  assert.equal(dashboardProbe.exitCode, 0, 'Production dashboard HTTP check failed');
  assert.equal(JSON.parse(dashboardProbe.output).status, 200);
  httpChecks.push({ service: 'dashboard', scope: 'container', status: 200 });
  const post = await json(`/api/projects/${PROJECT_ID}/services/${backend.id}/exec`, 'POST', { command: MIGRATION_READ_COMMAND, timeoutMs: 30000 });
  const postExec = post.data ?? post;
  assert.equal(postExec.exitCode, 0);
  assert.ok(!postExec.truncated && !postExec.timedOut);
  const postRows = JSON.parse(postExec.output);
  assertMigrationState(expectedMigrations, postRows);
  assert.deepEqual(postRows, rows, 'Migration metadata changed during publication');
  const { data: finalProject } = await json(`/api/projects/${PROJECT_ID}`);
  assertProductionProject(finalProject);
  assert.equal(finalProject.activeDeploymentId, ready.id);
  const finalSource = await request('https://api.github.com/repos/tariiq222/sawaa/git/ref/heads/main', {
    headers: { Authorization: `Bearer ${githubToken}` }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!finalSource.ok) throw new Error(`Final source check HTTP ${finalSource.status}`);
  const sourceSuperseded = (await finalSource.json()).object?.sha !== sha;
  assert.equal(sourceSuperseded, false, 'Production source was superseded during verification');
  return { authorization, backup, sourceSuperseded, environment: 'production', projectId: PROJECT_ID, sourceSha: sha, backendGitSha: health.gitSha,
    deploymentId: ready.id, observedAt: new Date().toISOString(), images: refs, httpChecks,
    migrations: { count: expectedMigrations.length, applied: false, verifiedReadOnly: true },
    infrastructurePreserved: true, services: after.map(({ serviceName, containerId, imageRef, status }) => ({ name: serviceName, containerId, imageRef, status })),
  };
}

export function assertBackupEvidence(backup, now) {
  assert.ok(backup, 'Verified production backup required');
  assert.equal(backup.projectId, PROJECT_ID);
  assert.match(backup.sourceSha, /^[a-f0-9]{40}$/);
  assert.match(backup.path, /^\/var\/backups\/sawaa\/pre-production-[A-Za-z0-9_-]+\/?$/);
  const age = now - Date.parse(backup.createdAt);
  assert.ok(Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000, 'Backup must be less than 24 hours old');
  for (const key of ['checksumVerified', 'databaseRestoreSucceeded', 'minioArchiveReadable', 'redisRdbValid']) assert.equal(backup[key], true, `Backup evidence missing ${key}`);
  assert.equal(backup.network, 'none');
  for (const key of ['migrations', 'Client', 'Booking', 'Payment']) assert.ok(Number.isSafeInteger(backup.sourceCounts?.[key]) && backup.sourceCounts[key] >= 0, 'Complete source counts required');
  assert.deepEqual(backup.restoredCounts, backup.sourceCounts, 'Restore counts differ from backup');
}

function hookIds(hooks, id) { return hooks.find(h => h.id === id).actionConfig.serviceIds; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifests = await Promise.all(APP_SERVICES.map(async name => JSON.parse(await readFile(resolve(process.argv[2], `${name}.json`), 'utf8'))));
  const evidence = await deployProduction({ sha: process.env.GITHUB_SHA, branch: process.env.GITHUB_REF_NAME,
    enabled: process.env.PRODUCTION_PREBUILT_DEPLOY, manifests, hookId: process.env.OPENSHIP_PRODUCTION_HOOK_ID,
    writeToken: process.env.OPENSHIP_PRODUCTION_DEPLOY_TOKEN, hookToken: process.env.OPENSHIP_PRODUCTION_DEPLOY_HOOK_TOKEN,
    githubToken: process.env.GITHUB_TOKEN, stagingReadToken: process.env.OPENSHIP_STAGING_READ_TOKEN,
    authorization: JSON.parse(process.env.PRODUCTION_RELEASE_AUTHORIZATION || 'null'),
    backup: JSON.parse(process.env.PRODUCTION_BACKUP_EVIDENCE || 'null'), onProgress: console.log });
  await writeFile(process.argv[3], JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  console.log(`Verified production deployment ${evidence.deploymentId} runs ${evidence.sourceSha}; infrastructure preserved`);
}
