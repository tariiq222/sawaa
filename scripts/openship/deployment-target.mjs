import { appendFileSync } from 'node:fs';

function deploymentTarget({ GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_SHA: sha,
  SAWAA_TARGET: target, SAWAA_REQUESTED_SHA: acceptedSha }) {
  if (event === 'pull_request') return 'staging';
  if (ref !== 'refs/heads/main') throw new Error('Deployment requires the main branch');
  if (event === 'push') return 'staging';
  if (event !== 'workflow_dispatch' || !['staging', 'production'].includes(target)) {
    throw new Error('Select staging or production as the manual deployment target');
  }
  if (target === 'production' && (!/^[a-f0-9]{40}$/.test(acceptedSha ?? '') || acceptedSha !== sha)) {
    throw new Error('The accepted SHA must match the checked-out main SHA');
  }
  return target;
}

const output = 'target=' + deploymentTarget(process.env) + '\n';
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(output);
