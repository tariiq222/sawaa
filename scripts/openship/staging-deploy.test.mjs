import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImageRefs, assertMigrationState, assertStagingProject, assertHookScope, assertRuntime, deployStaging, migrationManifest, PROJECT_ID, APP_SERVICES } from './staging-deploy.mjs';

const SHA = 'a'.repeat(40);
const manifests = ['backend', 'dashboard', 'website'].map((service, i) => ({ service, sha: SHA, environment: 'staging', digest: `sha256:${String(i + 1).repeat(64)}` }));
const services = ['postgres', 'redis', 'minio', 'backend', 'dashboard', 'website'].map(name => ({ id: `svc_${name}`, name, enabled: true, commandArgv: name === 'backend' ? ['node', 'dist/src/main.js'] : null }));
const project = { id: 'proj_7M0RNj59nQnafh1m', gitBranch: 'develop', autoDeploy: false, composePath: 'docker/openship/compose.prebuilt.yml', activeDeploymentId: 'dep_old' };
const hook = { id: 'hook1', enabled: true, authMode: 'token', actionType: 'deploy', requiresReauthorization: false, actionConfig: { serviceIds: services.filter(s => ['backend', 'dashboard', 'website'].includes(s.name)).map(s => s.id) } };
const before = services.map(s => ({ serviceName: s.name, containerId: `old_${s.name}`, imageRef: `old:${s.name}`, status: 'running', duplicates: [] }));
const expectedMigration = [{ name: 'migration1', checksum: 'c'.repeat(64) }];
const migrationRows = [{ migration_name: 'migration1', checksum: 'c'.repeat(64), finished_at: '2026-10-10', rolled_back_at: null }];

test('migration manifest reads the repository migration directory', async () => {
  const rows = await migrationManifest();
  assert.ok(rows.length >= 120);
  assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.checksum)));
});

test('only accepts a complete same-SHA staging digest set', () => {
  assert.equal(buildImageRefs(SHA, manifests).backend, `ghcr.io/tariiq222/sawaa-backend@${manifests[0].digest}`);
  for (const bad of [manifests.slice(1), [...manifests, manifests[0]], manifests.map(m => ({ ...m, sha: 'b'.repeat(40) })), manifests.map(m => ({ ...m, environment: 'production' })), manifests.map(m => ({ ...m, digest: 'staging' }))]) {
    assert.throws(() => buildImageRefs(SHA, bad));
  }
});

test('rejects production or push auto-deploy before mutation', () => {
  assertStagingProject(project);
  for (const p of [{ ...project, id: 'proj_tsxe0sAW3u2AMSGO' }, { ...project, gitBranch: 'main' }, { ...project, autoDeploy: true }, { ...project, composePath: 'docker/openship/compose.yml' }]) assert.throws(() => assertStagingProject(p));
});

test('hook must target exactly the three application services', () => {
  assertHookScope(hook, services);
  for (const h of [{ ...hook, actionConfig: {} }, { ...hook, enabled: false }, { ...hook, actionConfig: { serviceIds: services.map(s => s.id) } }, { ...hook, requiresReauthorization: true }]) assert.throws(() => assertHookScope(h, services));
  assert.throws(() => assertHookScope(hook, services.map(s => s.name === 'backend' ? { ...s, commandArgv: ['sh', 'start-backend.sh'] } : s)));
});

test('migration verification rejects missing, modified, failed or unknown migrations without applying them', () => {
  assertMigrationState(expectedMigration, migrationRows);
  for (const rows of [[], [{ ...migrationRows[0], checksum: 'd'.repeat(64) }], [{ ...migrationRows[0], finished_at: null }], [...migrationRows, { ...migrationRows[0], migration_name: 'extra' }]]) assert.throws(() => assertMigrationState(expectedMigration, rows));
});

test('accepts only the exact documented historical staging checksum pairs', () => {
  const name = '20260520134448_add_delivery_type_and_bundles';
  const expected = [{ name, checksum: '778c3f29ceeaa9eb69275e105b169629e4750a0717f11ab2def95023887a661f' }];
  const historical = [{ migration_name: name, checksum: '', finished_at: '2026-05-20', rolled_back_at: null }];
  assertMigrationState(expected, historical);
  assert.throws(() => assertMigrationState(expected.map(e => ({ ...e, checksum: 'f'.repeat(64) })), historical));
  assert.throws(() => assertMigrationState(expected, historical.map(r => ({ ...r, checksum: 'd'.repeat(64) }))));
});

test('runtime verification rejects stale application images and replaced infrastructure', () => {
  const refs = buildImageRefs(SHA, manifests);
  const after = before.map(c => APP_SERVICES.includes(c.serviceName) ? { ...c, containerId: `new_${c.serviceName}`, imageRef: refs[c.serviceName] } : c);
  assertRuntime(before, after, refs);
  assert.throws(() => assertRuntime(before, after.map(c => c.serviceName === 'backend' ? { ...c, imageRef: 'ghcr.io/tariiq222/sawaa-backend:staging' } : c), refs));
  assert.throws(() => assertRuntime(before, after.map(c => c.serviceName === 'postgres' ? { ...c, containerId: 'replaced' } : c), refs));
});

function fixture({ superseded = false, missingMigration = false, disabled = false, advanceDuringPatch = false, advanceBeforeHook = false, compensationFails = false } = {}) {
  const calls = [];
  const refs = buildImageRefs(SHA, manifests);
  let fired = false; let pinned = 'develop'; let advanced = false;
  const request = async (url, opts = {}) => {
    const u = new URL(url); const method = opts.method ?? 'GET';
    calls.push({ url, method, body: opts.body && JSON.parse(opts.body) });
    let body;
    if (u.hostname === 'api.github.com') body = { object: { sha: superseded || advanced ? 'b'.repeat(40) : SHA } };
    else if (u.pathname.endsWith('/incoming-webhooks')) body = { data: [hook] };
    else if (u.pathname.endsWith('/services/containers')) body = { success: true, containers: fired ? before.map(c => APP_SERVICES.includes(c.serviceName) ? { ...c, containerId: `new_${c.serviceName}`, imageRef: refs[c.serviceName] } : c) : before };
    else if (u.pathname.endsWith('/services')) body = { success: true, services };
    else if (u.pathname.endsWith('/services/svc_dashboard/exec')) body = { data: { exitCode: 0, output: '{"status":200}' } };
    else if (u.pathname.endsWith('/exec')) body = { success: true, exitCode: 0, output: JSON.stringify(missingMigration ? [] : migrationRows) };
    else if (u.pathname.endsWith('/branch')) { pinned = JSON.parse(opts.body).branch; body = { success: true }; }
    else if (u.pathname.endsWith('/env')) { if (method === 'PATCH' && advanced && compensationFails) return { ok: false, status: 503 }; if (method === 'PATCH' && advanceDuringPatch) advanced = true; body = { data: APP_SERVICES.map(name => ({ key: `${name.toUpperCase()}_IMAGE`, value: `old:${name}` })) }; }
    else if (u.pathname.endsWith('/incoming/hook1')) { assert.equal(pinned, SHA); if (advanceBeforeHook) advanced = true; fired = true; body = { data: { action: 'deploy', ref: 'dep_new' } }; }
    else if (u.pathname.endsWith('/deployments/dep_new')) body = { data: { id: 'dep_new', projectId: PROJECT_ID, branch: SHA, commitSha: SHA, status: 'ready', meta: { strictServiceScope: true, targetServiceIds: hook.actionConfig.serviceIds } } };
    else if (u.pathname.endsWith(`/projects/${PROJECT_ID}`)) body = { data: { ...project, gitBranch: pinned, activeDeploymentId: fired ? 'dep_new' : 'dep_old' } };
    else if (u.pathname.endsWith('/health')) body = { gitSha: SHA };
    else body = {};
    return { ok: true, status: 200, json: async () => body, body: { cancel: async () => {} } };
  };
  return { calls, options: { sha: SHA, branch: 'develop', enabled: disabled ? 'false' : 'true', manifests, hookId: 'hook1', writeToken: 'test', hookToken: 'test', githubToken: 'test', request, sleep: async () => {}, migrations: expectedMigration, attempts: 1 } };
}

test('deployment pins images only after read-only schema and scope gates, then verifies its returned deployment', async () => {
  const f = fixture();
  const result = await deployStaging(f.options);
  assert.equal(result.sourceSha, SHA);
  assert.equal(result.deploymentId, 'dep_new');
  const patch = f.calls.find(c => c.method === 'PATCH');
  assert.deepEqual(patch.body.upserts.map(v => v.key).sort(), ['BACKEND_IMAGE', 'DASHBOARD_IMAGE', 'WEBSITE_IMAGE']);
  assert.deepEqual(patch.body.deletes, []);
  assert.ok(f.calls.findIndex(c => c.url.endsWith('/exec')) < f.calls.indexOf(patch));
  const command = f.calls.find(c => c.url.endsWith('/exec')).body.command;
  assert.match(command, /BEGIN READ ONLY/);
  assert.doesNotMatch(command, /migrate deploy|INSERT|UPDATE|DELETE|CREATE|DROP/);
  assert.ok(f.calls.every(c => !c.url.includes('proj_tsxe0sAW3u2AMSGO')));
});

test('superseded SHA, disabled automation and pending schema never change image refs or invoke the hook', async () => {
  for (const options of [{ superseded: true }, { disabled: true }, { missingMigration: true }]) {
    const f = fixture(options);
    await assert.rejects(deployStaging(f.options));
    assert.equal(f.calls.filter(c => ['PATCH', 'PUT', 'DELETE'].includes(c.method) || c.url.endsWith('/incoming/hook1')).length, 0);
  }
});

test('HEAD advancing during image publication restores develop and old refs without invoking hook', async () => {
  const f = fixture({ advanceDuringPatch: true });
  await assert.rejects(deployStaging(f.options), /superseded/);
  assert.equal(f.calls.filter(c => c.url.endsWith('/incoming/hook1')).length, 0);
  const branches = f.calls.filter(c => c.url.endsWith('/branch'));
  assert.deepEqual(branches.map(c => c.body.branch), [SHA, 'develop']);
  const patches = f.calls.filter(c => c.method === 'PATCH');
  assert.equal(patches.length, 2);
  assert.ok(patches[1].body.upserts.every(v => v.value.startsWith('old:')));
});

test('HEAD advancing at the hook still deploys the immutable checked source and restores develop', async () => {
  const f = fixture({ advanceBeforeHook: true });
  const result = await deployStaging(f.options);
  assert.equal(result.sourceSha, SHA);
  assert.equal(result.sourceSuperseded, true);
  assert.deepEqual(f.calls.filter(c => c.url.endsWith('/branch')).map(c => c.body.branch), [SHA, 'develop']);
});

test('branch restoration is attempted even if image compensation fails', async () => {
 const f=fixture({advanceDuringPatch:true,compensationFails:true});
 await assert.rejects(deployStaging(f.options), /cleanup failed/);
 assert.deepEqual(f.calls.filter(c=>c.url.endsWith('/branch')).map(c=>c.body.branch),[SHA,'develop']);
});
