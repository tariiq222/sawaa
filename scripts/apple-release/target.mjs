import { pathToFileURL } from 'node:url';

export function resolveReleaseTarget(branch, target) {
  if (branch !== 'main') throw new Error('Unsupported release branch');
  if (!['staging', 'production'].includes(target)) throw new Error('Select an explicit TestFlight target');
  const staging = target === 'staging';
  return {
    branch,
    profile: staging ? 'staging' : 'production',
    apiUrl: staging ? 'https://staging.sawaa.sa/api/v1' : 'https://api.sawaa.sa/api/v1',
    projectId: staging ? 'proj_7M0RNj59nQnafh1m' : 'proj_tsxe0sAW3u2AMSGO',
    readinessUrl: staging ? 'https://staging.sawaa.sa/api/v1/health/ready' : 'https://api.sawaa.sa/api/v1/health/ready',
    websiteUrl: staging ? 'https://staging.sawaa.sa/' : 'https://sawaa.sa/',
    dashboardUrl: staging ? null : 'https://admin.sawaa.sa/',
  };
}

export function releaseTarget(branch, target, event) {
  const resolved = resolveReleaseTarget(branch, target);
  if (!['push', 'workflow_dispatch'].includes(event)) throw new Error('Unsupported TestFlight event');
  if (target === 'production' && event !== 'workflow_dispatch') throw new Error('Production TestFlight requires manual dispatch');
  return resolved;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(releaseTarget(process.argv[2], process.argv[3], process.argv[4])));
}
