import { spawnSync } from 'node:child_process';
import path from 'node:path';

const mobileRoot = path.resolve(__dirname);
const expoCli = path.join(mobileRoot, 'node_modules/.bin/expo');

function resolveExpoConfig(overrides: NodeJS.ProcessEnv, json = true) {
  // Keep local dotenv files from supplying values deliberately absent in a test.
  const env: NodeJS.ProcessEnv = { ...process.env, ...overrides, EXPO_NO_DOTENV: '1' };
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

  it('loads the production config with its fixed public API URL', () => {
    const result = resolveExpoConfig({
      EAS_BUILD_PROFILE: 'production',
      NODE_ENV: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.sawaa.sa/api/v1',
    });

    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout) as { slug?: string };
    expect(config.slug).toBe('sawa');
  });
});


describe('Apple Pay build entitlement', () => {
  const env = { NODE_ENV: 'development', EAS_BUILD_PROFILE: 'development', EXPO_PUBLIC_API_URL: 'https://example.com/api/v1' };
  it('omits the entitlement when merchant id is missing', () => {
    const result = resolveExpoConfig({ ...env, EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID: '' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).ios.entitlements?.['com.apple.developer.in-app-payments']).toBeUndefined();
  });
  it('binds runtime capability to the built merchant entitlement', () => {
    const result = resolveExpoConfig({ ...env, EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID: 'merchant.sa.sawa.app' });
    expect(result.status).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.extra.applePayMerchantId).toBe('merchant.sa.sawa.app');
    expect(config.ios.entitlements['com.apple.developer.in-app-payments']).toEqual(['merchant.sa.sawa.app']);
  });
  it.each(['invalid/id', ' ', 'merchant.sa..sawa'])('rejects malformed merchant id %p before a native build', (merchantId) => {
    expect(resolveExpoConfig({ ...env, EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID: merchantId }, false).status).not.toBe(0);
  });
});
