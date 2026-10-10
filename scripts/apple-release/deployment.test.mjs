import test from 'node:test';
import assert from 'node:assert/strict';

const sha = 'a'.repeat(40);
const target = { branch: 'develop', projectId: 'proj_staging' };
function fixture() {
  return {
    project: { id: 'proj_staging', gitBranch: 'develop', activeDeploymentId: 'dep_current' },
    deployment: { id: 'dep_current', projectId: 'proj_staging', branch: 'develop', commitSha: sha, status: 'ready' },
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
