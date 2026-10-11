// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('./next.config.mjs')).default;
}

afterEach(() => vi.unstubAllEnvs());

describe('isolated local middleware origin', () => {
  const cases: Array<[string, string | undefined, boolean]> = [
    ['development', undefined, false],
    ['development', 'false', false],
    ['development', 'true', true],
    ['production', undefined, false],
    ['production', 'true', false],
    ['test', 'true', false],
  ];
  it.each(cases)('NODE_ENV=%s E2E_TEST=%s preserves raw middleware URLs only when isolated development', async (nodeEnv, e2eFlag, preserve) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('E2E_TEST', e2eFlag);
    const config = await loadConfig();
    expect(config.skipMiddlewareUrlNormalize).toBe(preserve);
  });
});
