import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { releaseTarget } from './target.mjs';

const OPENSHIP = 'https://open.webvue.pro';
const SERVICES = ['backend', 'dashboard', 'website', 'postgres', 'redis', 'minio'];

export function verifyDeployment(target, sha, { project, deployment, containers }) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.equal(project.id, target.projectId);
  assert.equal(project.gitBranch, target.branch);
  assert.equal(deployment.projectId, target.projectId);
  assert.equal(deployment.branch, target.branch);
  assert.equal(deployment.commitSha, sha);
  assert.equal(deployment.status, 'ready');
  assert.equal(project.activeDeploymentId, deployment.id);
  assert.equal(containers.length, SERVICES.length);
  assert.equal(new Set(containers.map(c => c.serviceName)).size, SERVICES.length);
  assert.equal(new Set(containers.map(c => c.containerId)).size, SERVICES.length);
  for (const name of SERVICES) {
    const container = containers.find(c => c.serviceName === name);
    assert.ok(container?.containerId && container.imageRef, `Missing ${name} runtime identity`);
    assert.equal(container.status, 'running', `${name} is not running`);
    assert.deepEqual(container.duplicates, [], `${name} has duplicate runtime matches`);
  }
  return {
    environment: target.profile, sourceSha: sha, projectId: project.id,
    deploymentId: deployment.id, observedAt: new Date().toISOString(),
    services: containers.map(c => ({ name: c.serviceName, containerId: c.containerId, imageRef: c.imageRef, status: c.status })),
  };
}

async function getJson(url, token, request = fetch) {
  const response = await request(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Release gate HTTP ${response.status}`);
  return response.json();
}

// A mobile-only push can legitimately leave server containers on the previous
// ready deployment. Require an observed no_changes result for the NEW SHA plus
// exact Git blob identities for every non-mobile/server input; record both SHAs.
export async function assertSameServerInputs(deployedSha, sourceSha, token, request = fetch) {
  const trees = await Promise.all([deployedSha, sourceSha].map(sha => getJson(
    `https://api.github.com/repos/tariiq222/sawaa/git/trees/${sha}?recursive=1`, token, request)));
  const fingerprint = data => {
    if (data.truncated || !Array.isArray(data.tree)) throw new Error('Incomplete Git tree evidence');
    return data.tree.filter(x => x.type !== 'tree'
      && !/^(apps\/mobile\/|docs\/|\.github\/|scripts\/apple-release\/)/.test(x.path)
      && !/^[^/]+\.md$/.test(x.path))
      .map(x => `${x.path}:${x.mode}:${x.type}:${x.sha}`).sort();
  };
  assert.deepEqual(fingerprint(trees[0]), fingerprint(trees[1]), 'Deployment server inputs differ from release source');
}

export async function assertCurrentSource(target, sha, githubToken, request = fetch) {
  const data = await getJson(`https://api.github.com/repos/tariiq222/sawaa/git/ref/heads/${target.branch}`, githubToken, request);
  if (data.object?.sha !== sha) throw new Error('Release source was superseded on GitHub');
}

export async function waitForDeployment(target, sha, token, {
  githubToken = process.env.GITHUB_TOKEN, timeoutMs = 40 * 60 * 1000,
  intervalMs = 30000, request = fetch, sleep = delay, now = Date.now,
} = {}) {
  if (!token || !githubToken) throw new Error('OpenShip and GitHub read credentials are required');
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    await assertCurrentSource(target, sha, githubToken, request);
    const { data: project } = await getJson(`${OPENSHIP}/api/projects/${target.projectId}`, token, request);
    if (!project || project.id !== target.projectId || project.gitBranch !== target.branch) throw new Error('OpenShip project identity mismatch');
    if (project.activeDeploymentId) {
      const { data: deployment } = await getJson(`${OPENSHIP}/api/deployments/${project.activeDeploymentId}`, token, request);
      if (deployment?.commitSha === sha && ['failed', 'cancelled', 'partial_failure', 'action_required'].includes(deployment.status)) {
        throw new Error(`Matching deployment failed: ${deployment.status}`);
      }
      let noChanges;
      if (deployment?.commitSha !== sha && deployment?.status === 'ready') {
        const history = await getJson(`${OPENSHIP}/api/projects/${target.projectId}/deployments?perPage=20`, token, request);
        const matching = history.rows?.find(d => d.commitSha === sha && d.projectId === target.projectId && d.branch === target.branch);
        if (matching && ['failed', 'cancelled', 'partial_failure', 'action_required'].includes(matching.status)) throw new Error(`Matching deployment failed: ${matching.status}`);
        noChanges = history.rows?.find(d => d.commitSha === sha && d.status === 'no_changes' && d.projectId === target.projectId && d.branch === target.branch);
        if (noChanges) await assertSameServerInputs(deployment.commitSha, sha, githubToken, request);
      }
      if (deployment?.status === 'ready' && (deployment.commitSha === sha || noChanges)) {
        const { success, containers } = await getJson(`${OPENSHIP}/api/projects/${target.projectId}/services/containers`, token, request);
        if (success !== true || !Array.isArray(containers)) throw new Error('Runtime observations unavailable');
        const evidence = verifyDeployment(target, deployment.commitSha, { project, deployment, containers });
        evidence.deployedSha = deployment.commitSha;
        evidence.sourceSha = sha;
        if (noChanges) evidence.noChangesDeploymentId = noChanges.id;
        evidence.httpChecks = [];
        for (const url of [target.readinessUrl, target.websiteUrl, target.dashboardUrl].filter(Boolean)) {
          const response = await request(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
          if (response.status !== 200) throw new Error(`Target readiness failed: ${new URL(url).hostname} HTTP ${response.status}`);
          await response.body?.cancel();
          evidence.httpChecks.push({ url, status: response.status });
        }
        const { data: freshProject } = await getJson(`${OPENSHIP}/api/projects/${target.projectId}`, token, request);
        if (freshProject.activeDeploymentId !== deployment.id) throw new Error('Deployment changed during verification');
        await assertCurrentSource(target, sha, githubToken, request);
        return evidence;
      }
    }
    console.log('Waiting for the matching OpenShip deployment');
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
  throw new Error('Matching OpenShip deployment timed out; Apple upload blocked');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = releaseTarget(process.env.GITHUB_REF_NAME);
  const evidence = await waitForDeployment(target, process.env.GITHUB_SHA, process.env.OPENSHIP_READ_TOKEN);
  await writeFile(process.argv[2], JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  console.log(`Verified ${target.profile} deployment ${evidence.deploymentId}`);
}
