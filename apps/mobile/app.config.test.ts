import { spawnSync } from 'node:child_process';
import path from 'node:path';

const mobileRoot = path.resolve(__dirname);
const expoCli = path.join(mobileRoot, 'node_modules/.bin/expo');

function resolveExpoConfig(overrides: NodeJS.ProcessEnv, json = true) {
  const env = { ...process.env, ...overrides };
  if (overrides.EXPO_PUBLIC_API_URL === undefined) {
    delete env.EXPO_PUBLIC_API_URL;
  }

  return spawnSync('/bin/sh', [expoCli, 'config', ...(json ? ['--json'] : [])], {
    cwd: mobileRoot,
    env,
    encoding: 'utf8',
  });
}

describe('Expo app config resolution', () => {
  it('fails before config output when a production API URL is missing', () => {
    const result = resolveExpoConfig({
      EAS_BUILD_PROFILE: 'production',
      NODE_ENV: 'production',
    }, false);

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'EXPO_PUBLIC_API_URL is required for production builds',
    );
  });

  it('loads the app config with a public DNS API URL', () => {
    const result = resolveExpoConfig({
      EAS_BUILD_PROFILE: 'production',
      NODE_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://fcm.example.com/api/v1',
    });

    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout) as { slug?: string };
    expect(config.slug).toBe('sawa');
  });
});
