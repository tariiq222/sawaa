import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBase } from './api-base';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getApiBase', () => {
  it('removes trailing slashes and does not duplicate the API prefix', () => {
    vi.stubEnv('INTERNAL_API_URL', 'https://example.test/api/v1///');
    expect(getApiBase()).toBe('https://example.test/api/v1');
  });

  it('does not spend quadratic time scanning a slash run before another character', () => {
    vi.stubEnv('INTERNAL_API_URL', `https://example.test/${'/'.repeat(100_000)}x`);
    const started = performance.now();
    expect(getApiBase()).toBe(`https://example.test/${'/'.repeat(100_000)}x/api/v1`);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
