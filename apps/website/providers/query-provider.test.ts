import { describe, expect, it } from 'vitest';

import { PublicFetchError } from '@/lib/public-fetch';
import { shouldRetryQuery } from './query-provider';

describe('shouldRetryQuery', () => {
  it.each([400, 401, 403, 404, 409, 422])(
    'does not retry deterministic HTTP %i errors',
    (status) => {
      expect(shouldRetryQuery(0, new PublicFetchError(status, {}))).toBe(false);
    },
  );

  it.each([408, 425, 429, 500])('retries transient HTTP %i errors once', (status) => {
    const error = new PublicFetchError(status, {});
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it('retries a network error once', () => {
    const error = new TypeError('Failed to fetch');
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });
});
