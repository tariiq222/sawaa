import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBase, getApiOrigin } from './api-base';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getApiBase', () => {
  it('uses the public API base when no internal server URL is available', () => {
    vi.stubEnv('INTERNAL_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://staging.sawaa.sa/api/v1');

    expect(getApiBase()).toBe('https://staging.sawaa.sa/api/v1');
  });

  it('keeps SSR requests internal while exposing the public origin for preconnect', () => {
    vi.stubEnv('INTERNAL_API_URL', 'http://backend:5100/api/v1');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://staging.sawaa.sa/api/v1');

    expect(getApiBase()).toBe('http://backend:5100/api/v1');
    expect(getApiOrigin()).toBe('https://staging.sawaa.sa');
  });

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
