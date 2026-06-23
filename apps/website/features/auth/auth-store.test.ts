import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ClientProfile } from '@sawaa/shared';

const CLIENT_KEY = 'sawa_client';

function makeProfile(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    id: 'c1',
    name: 'Sara',
    email: 'sara@test.com',
    phone: '+966500000000',
    emailVerified: '2026-01-01T00:00:00.000Z',
    phoneVerified: null,
    accountType: 'REGISTERED',
    claimedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Fresh module instance per call — bypasses the in-memory `storedClient`
// module variable so we can exercise the localStorage re-read path.
async function freshStore(): Promise<typeof import('./auth-store')> {
  vi.resetModules();
  return import('./auth-store');
}

describe('auth-store', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setClient / getClient', () => {
    it('returns null from getClient when nothing has been stored', async () => {
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns the stored profile from getClient after setClient', async () => {
      const { setClient, getClient } = await freshStore();
      const profile = makeProfile();
      setClient(profile);
      expect(getClient()).toEqual(profile);
    });

    it('persists the profile to localStorage with a savedAt timestamp envelope', async () => {
      const { setClient } = await freshStore();
      const profile = makeProfile({ id: 'c2' });
      setClient(profile);
      const raw = localStorage.getItem(CLIENT_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.profile).toEqual(profile);
      expect(typeof parsed.savedAt).toBe('number');
      expect(parsed.savedAt).toBeGreaterThan(Date.now() - 5_000);
      expect(parsed.savedAt).toBeLessThanOrEqual(Date.now());
    });

    it('treats a null setClient as a clearAuth', async () => {
      const { setClient } = await freshStore();
      setClient(makeProfile());
      setClient(null);
      expect(localStorage.getItem(CLIENT_KEY)).toBeNull();
    });
  });

  describe('clearAuth / isAuthenticated', () => {
    it('clearAuth removes the localStorage entry', async () => {
      const { setClient, clearAuth } = await freshStore();
      setClient(makeProfile());
      clearAuth();
      expect(localStorage.getItem(CLIENT_KEY)).toBeNull();
    });

    it('isAuthenticated returns false when no client is set', async () => {
      const { isAuthenticated } = await freshStore();
      expect(isAuthenticated()).toBe(false);
    });

    it('isAuthenticated returns true after a valid profile is stored', async () => {
      const { setClient, isAuthenticated } = await freshStore();
      setClient(makeProfile());
      expect(isAuthenticated()).toBe(true);
    });

    it('isAuthenticated returns false after clearAuth', async () => {
      const { setClient, clearAuth, isAuthenticated } = await freshStore();
      setClient(makeProfile());
      clearAuth();
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('TTL and corruption handling on localStorage read', () => {
    function writeRaw(raw: string) {
      localStorage.setItem(CLIENT_KEY, raw);
    }

    it('returns null when the stored profile is older than the 15-minute TTL', async () => {
      const old = Date.now() - 16 * 60 * 1000;
      writeRaw(JSON.stringify({ profile: makeProfile({ id: 'old' }), savedAt: old }));
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns the profile when within TTL', async () => {
      const fresh = Date.now() - 5 * 60 * 1000;
      writeRaw(JSON.stringify({ profile: makeProfile({ id: 'fresh' }), savedAt: fresh }));
      const { getClient } = await freshStore();
      expect(getClient()?.id).toBe('fresh');
    });

    it('returns null when the envelope is missing a savedAt number', async () => {
      writeRaw(JSON.stringify({ profile: makeProfile() }));
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns null when the envelope is missing the profile', async () => {
      writeRaw(JSON.stringify({ savedAt: Date.now() }));
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns null when the envelope is not an object', async () => {
      writeRaw('"just a string"');
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns null when the stored payload is malformed JSON', async () => {
      writeRaw('{not json');
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });

    it('returns null when localStorage is empty', async () => {
      const { getClient } = await freshStore();
      expect(getClient()).toBeNull();
    });
  });

  describe('SSR safety', () => {
    it('setClient and clearAuth do not throw when window is undefined', async () => {
      // The module guards every localStorage call inside a `typeof window !==
      // 'undefined'` check. We simulate SSR by temporarily removing window.
      const originalWindow = globalThis.window;
      // @ts-expect-error -- simulate SSR for the duration of the assertion.
      delete globalThis.window;
      const { setClient, clearAuth } = await freshStore();
      expect(() => setClient(makeProfile())).not.toThrow();
      expect(() => setClient(null)).not.toThrow();
      expect(() => clearAuth()).not.toThrow();
      // No localStorage access happened during SSR.
      expect(localStorage.getItem(CLIENT_KEY)).toBeNull();
      globalThis.window = originalWindow;
    });
  });
});
