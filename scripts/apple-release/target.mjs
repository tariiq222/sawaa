import { pathToFileURL } from 'node:url';

export function releaseTarget(branch) {
  if (!['develop', 'main'].includes(branch)) throw new Error('Unsupported release branch');
  const staging = branch === 'develop';
  return {
    branch,
    profile: staging ? 'staging' : 'production',
    apiUrl: staging ? 'https://staging.sawaa.sa/api/v1' : 'https://api.sawaa.sa/api/v1',
    projectId: staging ? 'proj_7M0RNj59nQnafh1m' : 'proj_tsxe0sAW3u2AMSGO',
    readinessUrl: staging ? 'https://staging.sawaa.sa/api/v1/health/ready' : 'https://api.sawaa.sa/api/v1/health/ready',
    websiteUrl: staging ? 'https://staging.sawaa.sa/' : 'https://www.sawaa.sa/',
    dashboardUrl: staging ? null : 'https://admin.sawaa.sa/',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(releaseTarget(process.argv[2])));
}
