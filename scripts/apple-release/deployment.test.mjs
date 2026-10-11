import test from 'node:test';
import assert from 'node:assert/strict';

const sha = 'a'.repeat(40);
const target = { profile: 'staging', branch: 'develop', projectId: 'proj_7M0RNj59nQnafh1m' };
function fixture() {
  return {
    project: { id: target.projectId, gitBranch: 'develop', activeDeploymentId: 'dep_current' },
    deployment: { id: 'dep_current', projectId: target.projectId, branch: 'develop', commitSha: sha, status: 'ready' },
    containers: ['backend', 'dashboard', 'website', 'postgres', 'redis', 'minio'].map((serviceName) => ({ serviceName, containerId: serviceName, status: 'running', duplicates: [], imageRef: 'image/' + serviceName })),
  };
}

test('self-hosted OpenShip reads use the public dashboard API proxy', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  const f = fixture(); const shipReads = [];
  const request = async url => {
    if (url.includes('api.github.com')) return { ok: true, json: async () => ({ object: { sha } }) };
    shipReads.push(url);
    if (!url.startsWith('https://open.webvue.pro/api/proxy/api/')) return { ok: false, status: 404 };
    const data = url.includes('/services/containers') ? { success: true, containers: f.containers }
      : url.includes('/projects/') ? { data: f.project } : { data: f.deployment };
    return { ok: true, json: async () => data };
  };
  const result = await waitForDeployment(target, sha, 'read', { githubToken: 'read', request });
  assert.equal(result.deploymentId, 'dep_current');
  assert.equal(shipReads.length, 4);
});

test('a ready deployment must be active, from the requested SHA and project', async () => {
  const { verifyDeployment } = await import('./deployment.mjs');
  assert.equal(verifyDeployment(target, sha, fixture()).deploymentId, 'dep_current');
  for (const change of [
    f => { f.deployment.commitSha = 'b'.repeat(40); },
    f => { f.deployment.status = 'partial_failure'; },
    f => { f.project.activeDeploymentId = 'dep_old'; },
    f => { f.project.id = 'proj_production'; },
    f => { f.deployment.branch = 'main'; },
  ]) { const f = fixture(); change(f); assert.throws(() => verifyDeployment(target, sha, f)); }
});

test('missing, unhealthy, duplicated and unknown services block release', async () => {
  const { verifyDeployment } = await import('./deployment.mjs');
  for (const change of [
    f => { f.containers.pop(); },
    f => { f.containers[0].status = 'unknown'; },
    f => { f.containers[0].containerId = null; },
    f => { f.containers[0].duplicates = ['other']; },
    f => { f.containers[0].imageRef = null; },
    f => { f.containers[5].serviceName = 'unexpected'; },
  ]) { const f = fixture(); change(f); assert.throws(() => verifyDeployment(target, sha, f)); }
});

test('old healthy source expires after a bounded wait', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  let clock = 0;
  const f = fixture(); f.deployment.commitSha = 'b'.repeat(40);
  const request = async url => ({ ok: true, status: 200, json: async () => url.includes('api.github.com') ? { object: { sha } } : url.includes('/deployments?') ? { data: [] } : url.includes('/api/projects/') ? { data: f.project } : { data: f.deployment } });
  await assert.rejects(waitForDeployment(target, sha, 'read', { githubToken: 'read', timeoutMs: 20, intervalMs: 10, now: () => clock, sleep: async ms => { clock += ms; }, request }), /timed out/);
  assert.equal(clock, 20);
});

test('a superseded branch stops before accessing OpenShip', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  let requestedShip = false;
  const request = async url => { if (!url.includes('api.github.com')) requestedShip = true; return { ok: true, json: async () => ({ object: { sha: 'b'.repeat(40) } }) }; };
  await assert.rejects(waitForDeployment(target, sha, 'read', { githubToken: 'read', request }), /superseded/);
  assert.equal(requestedShip, false);
});

test('no-change deployment only permits identical server inputs, with separate SHA evidence', async () => {
  const { assertSameServerInputs } = await import('./deployment.mjs');
  const tree = [{path:'apps/backend/a.ts',type:'blob',sha:'one',mode:'100644'}, {path:'apps/mobile/a.ts',type:'blob',sha:'mobile',mode:'100644'}];
  const request = async url => ({ok:true,json:async()=>({truncated:false,tree:tree.map(x=>url.includes('/'+sha+'?')&&x.path.startsWith('apps/mobile/')?{...x,sha:'new-mobile'}:x)})});
  await assertSameServerInputs('b'.repeat(40),sha,'read',request);
  await assert.rejects(assertSameServerInputs('b'.repeat(40),sha,'read',async url=>({ok:true,json:async()=>({truncated:false,tree:tree.map(x=>url.includes('/'+sha+'?')&&x.path.startsWith('apps/backend/')?{...x,sha:'different'}:x)})})),/server inputs differ/);
  await assert.rejects(assertSameServerInputs('b'.repeat(40),sha,'read',async()=>({ok:true,json:async()=>({truncated:true,tree})})),/Incomplete/);
});

test('matching no_changes plus identical server tree unlocks live checks, recording both sources', async()=>{
 const {waitForDeployment}=await import('./deployment.mjs');const f=fixture();f.deployment.commitSha='b'.repeat(40);const checks=[];
 const request=async url=>{let data;if(url.includes('/git/ref/'))data={object:{sha}};else if(url.includes('/git/trees/'))data={truncated:false,tree:[{path:'apps/backend/a.ts',type:'blob',mode:'100644',sha:'same'}]};else if(url.includes('/services/containers'))data={success:true,containers:f.containers};else if(url.includes('/deployments?'))data={data:[{...f.deployment,id:'nochanges',commitSha:sha,status:'no_changes'}]};else if(url.includes('/api/projects/'))data={data:f.project};else if(url.includes('/api/deployments/'))data={data:f.deployment};else {checks.push(url);data={};}return {ok:true,status:200,json:async()=>data};};
 let clock=0;const result=await waitForDeployment({...target,profile:'staging',readinessUrl:'https://staging.test/ready',websiteUrl:'https://staging.test/'},sha,'read',{githubToken:'read',request,timeoutMs:20,intervalMs:10,now:()=>clock,sleep:async ms=>{clock+=ms}});assert.equal(result.sourceSha,sha);assert.equal(result.deployedSha,'b'.repeat(40));assert.equal(result.noChangesDeploymentId,'nochanges');assert.equal(checks.length,2);
});

test('staging accepts only its exact frozen deployment ref; production stays branch-bound', async () => {
 const {verifyDeployment}=await import('./deployment.mjs'); const f=fixture(); f.deployment.branch=sha;
 assert.equal(verifyDeployment(target,sha,f).deploymentId,'dep_current');
 f.deployment.branch='b'.repeat(40); assert.throws(()=>verifyDeployment(target,sha,f));
 const prod={profile:'production',branch:'main',projectId:'proj_production'}; f.project.id=prod.projectId; f.project.gitBranch='main'; f.deployment.projectId=prod.projectId; f.deployment.branch=sha;
 assert.throws(()=>verifyDeployment(prod,sha,f));
});

test('staging gate waits for its temporary SHA source selection to return to develop', async () => {
 const {waitForDeployment}=await import('./deployment.mjs'); const f=fixture();f.deployment.branch=sha;let clock=0;
 const request=async url=>({ok:true,status:200,json:async()=>url.includes('api.github.com')?{object:{sha}}:url.includes('/services/containers')?{success:true,containers:f.containers}:url.includes('/projects/')?{data:{...f.project,gitBranch:clock===0?sha:'develop'}}:{data:f.deployment}});
 const result=await waitForDeployment(target,sha,'read',{githubToken:'read',timeoutMs:20,intervalMs:10,now:()=>clock,sleep:async ms=>{clock+=ms},request});
 assert.equal(result.deploymentId,'dep_current');assert.equal(clock,10);
});

function prebuiltFixture(source = sha) {
  const f = fixture();
  f.deployment.branch = source;
  f.deployment.commitSha = null;
  for (const c of f.containers.filter(c => ['backend', 'dashboard', 'website'].includes(c.serviceName))) {
    c.imageRef = `ghcr.io/tariiq222/sawaa-${c.serviceName}@sha256:${'c'.repeat(64)}`;
  }
  return f;
}

test('image-only staging metadata requires a frozen ref, digest refs and independent backend SHA proof', async () => {
  const { verifyDeployment } = await import('./deployment.mjs');
  const f = prebuiltFixture();
  assert.throws(() => verifyDeployment(target, sha, f), /backend/);
  assert.equal(verifyDeployment(target, sha, { ...f, backendGitSha: sha }).deploymentId, 'dep_current');
  assert.throws(() => verifyDeployment(target, sha, { ...f, backendGitSha: 'b'.repeat(40) }), /backend/);
  f.deployment.commitSha = 'b'.repeat(40);
  assert.throws(() => verifyDeployment(target, sha, { ...f, backendGitSha: sha }), /contradict/);
  f.deployment.commitSha = null;
  f.containers[0].imageRef = 'backend:staging';
  assert.throws(() => verifyDeployment(target, sha, { ...f, backendGitSha: sha }), /digest/);
  f.deployment.branch = 'develop';
  assert.throws(() => verifyDeployment(target, sha, { ...f, backendGitSha: sha }));
  const prod = { profile: 'production', branch: 'main', projectId: 'proj_tsxe0sAW3u2AMSGO' };
  const p = prebuiltFixture();
  p.project.id = prod.projectId; p.project.gitBranch = 'main'; p.deployment.projectId = prod.projectId;
  assert.throws(() => verifyDeployment(prod, sha, { ...p, backendGitSha: sha }));
});

test('image-only ready staging gate reads public health without credentials and rejects mismatched SHA', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  const f = prebuiltFixture();
  const healthUrl = 'https://staging.test/api/v1/health';
  const nullTarget = { ...target, readinessUrl: `${healthUrl}/ready` };
  let healthSha = sha; const healthRequests = [];
  const request = async (url, opts) => {
    let data;
    if (url.includes('api.github.com')) data = { object: { sha } };
    else if (url === healthUrl) { healthRequests.push(opts); data = { gitSha: healthSha }; }
    else if (url.includes('/services/containers')) data = { success: true, containers: f.containers };
    else if (url.includes('/projects/')) data = { data: f.project };
    else if (url.includes('/deployments/')) data = { data: f.deployment };
    else if (url === `${healthUrl}/ready`) data = {};
    else throw new Error(`Unexpected URL ${url}`);
    return { ok: true, status: 200, json: async () => data };
  };
  const evidence = await waitForDeployment(nullTarget, sha, 'read', { githubToken: 'read', request });
  assert.equal(evidence.deployedSha, sha);
  assert.equal(evidence.backendGitSha, sha);
  assert.equal(healthRequests.length, 1);
  assert.equal(healthRequests[0].headers, undefined);
  healthSha = 'b'.repeat(40);
  await assert.rejects(waitForDeployment(nullTarget, sha, 'read', { githubToken: 'read', request }), /backend/);
});

test('no_changes matching resolves frozen refs with null metadata while proving the active backend source', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  const oldSha = 'b'.repeat(40); const f = prebuiltFixture(oldSha);
  const nullTarget = { ...target, apiUrl: 'https://staging.test/api/v1' };
  const request = async url => {
    let data;
    if (url.includes('/git/ref/')) data = { object: { sha } };
    else if (url.includes('/git/trees/')) data = { truncated: false, tree: [{ path: 'apps/backend/a.ts', type: 'blob', mode: '100644', sha: 'same' }] };
    else if (url.endsWith('/health')) data = { gitSha: oldSha };
    else if (url.includes('/services/containers')) data = { success: true, containers: f.containers };
    else if (url.includes('/deployments?')) data = { data: [{ ...f.deployment, id: 'nochanges', branch: sha, status: 'no_changes' }] };
    else if (url.includes('/projects/')) data = { data: f.project };
    else data = { data: f.deployment };
    return { ok: true, status: 200, json: async () => data };
  };
  const evidence = await waitForDeployment(nullTarget, sha, 'read', { githubToken: 'read', request });
  assert.equal(evidence.sourceSha, sha);
  assert.equal(evidence.deployedSha, oldSha);
  assert.equal(evidence.backendGitSha, oldSha);
  assert.equal(evidence.noChangesDeploymentId, 'nochanges');
});

function startupFixture({ indefinitely = false, change } = {}) {
  const f = prebuiltFixture();
  if (change) change(f);
  let clock = 0; let healthReads = 0; let sourceReads = 0; let runtimeReads = 0;
  const request = async url => {
    let data;
    if (url.includes('api.github.com')) { sourceReads++; data = { object: { sha } }; }
    else if (url.endsWith('/health')) { healthReads++; data = { gitSha: sha }; }
    else if (url.includes('/services/containers')) {
      runtimeReads++;
      data = { success: true, containers: f.containers.map(c => c.serviceName === 'website'
        ? { ...c, status: clock === 0 || indefinitely ? 'starting' : c.status } : c) };
    } else if (url.includes('/projects/')) data = { data: f.project };
    else data = { data: f.deployment };
    return { ok: true, status: 200, json: async () => data };
  };
  return {
    f, request, options: { githubToken: 'read', request, timeoutMs: 20, intervalMs: 10,
      now: () => clock, sleep: async ms => { clock += ms; } },
    observed: () => ({ clock, healthReads, sourceReads, runtimeReads }),
  };
}

test('ready image-only staging waits for validated app startup, then reobserves source and runtime', async () => {
  const { waitForDeployment, verifyDeployment } = await import('./deployment.mjs');
  const f = startupFixture();
  assert.throws(() => verifyDeployment(target, sha, { ...f.f, backendGitSha: sha,
    containers: f.f.containers.map(c => c.serviceName === 'website' ? { ...c, status: 'starting' } : c) }), /not running/);
  const evidence = await waitForDeployment({ ...target, apiUrl: 'https://staging.test/api/v1' }, sha, 'read', f.options);
  assert.equal(evidence.backendGitSha, sha);
  assert.deepEqual(f.observed(), { clock: 10, healthReads: 1, sourceReads: 3, runtimeReads: 2 });
});

test('indefinite app startup expires without inventing backend health evidence', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  const f = startupFixture({ indefinitely: true });
  await assert.rejects(waitForDeployment({ ...target, apiUrl: 'https://staging.test/api/v1' }, sha, 'read', f.options), /timed out/);
  assert.deepEqual(f.observed(), { clock: 20, healthReads: 0, sourceReads: 2, runtimeReads: 2 });
});

test('startup never excuses invalid identities, refs, source metadata or infrastructure state', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  for (const change of [
    f => { f.containers[0].duplicates = ['other']; },
    f => { f.containers[0].imageRef = 'backend:staging'; },
    f => { f.containers[0].imageRef = f.containers[1].imageRef; },
    f => { f.containers[0].status = 'stopped'; },
    f => { f.containers[3].status = 'starting'; },
    f => { f.containers[0].containerId = f.containers[1].containerId; },
    f => { f.deployment.projectId = 'wrong'; },
    f => { f.deployment.commitSha = 'b'.repeat(40); },
  ]) {
    const f = startupFixture({ change });
    await assert.rejects(waitForDeployment({ ...target, apiUrl: 'https://staging.test/api/v1' }, sha, 'read', f.options));
    assert.equal(f.observed().clock, 0);
    assert.equal(f.observed().healthReads, 0);
  }
});

test('production rejects app startup immediately', async () => {
  const { waitForDeployment } = await import('./deployment.mjs');
  const prod = { profile: 'production', branch: 'main', projectId: 'proj_tsxe0sAW3u2AMSGO' };
  const f = startupFixture({ change: f => {
    f.project.id = prod.projectId; f.project.gitBranch = 'main';
    f.deployment.projectId = prod.projectId; f.deployment.branch = 'main'; f.deployment.commitSha = sha;
  } });
  await assert.rejects(waitForDeployment(prod, sha, 'read', f.options), /not running/);
  assert.equal(f.observed().clock, 0);
});
