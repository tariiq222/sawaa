import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOtpSession,
  setOtpSessionToken,
  getOtpSessionToken,
} from './use-otp-session';

// Each test re-imports the module so the module-scoped `storedToken`
// starts at null (the hook, the setter, and the getter all share the same
// module variable).
async function freshSession() {
  const mod = await import('./use-otp-session');
  return {
    setOtpSessionToken: mod.setOtpSessionToken,
    getOtpSessionToken: mod.getOtpSessionToken,
    useOtpSession: mod.useOtpSession,
  };
}

describe('use-otp-session', () => {
  beforeEach(async () => {
    const { setOtpSessionToken } = await freshSession();
    setOtpSessionToken(null);
  });

  describe('module setters/getters', () => {
    it('getOtpSessionToken returns null when nothing has been stored', async () => {
      const { getOtpSessionToken } = await freshSession();
      expect(getOtpSessionToken()).toBeNull();
    });

    it('setOtpSessionToken stores a value readable by getOtpSessionToken', async () => {
      const { setOtpSessionToken, getOtpSessionToken } = await freshSession();
      setOtpSessionToken('otp-tok-1');
      expect(getOtpSessionToken()).toBe('otp-tok-1');
    });

    it('setOtpSessionToken(null) clears the stored value', async () => {
      const { setOtpSessionToken, getOtpSessionToken } = await freshSession();
      setOtpSessionToken('otp-tok-2');
      setOtpSessionToken(null);
      expect(getOtpSessionToken()).toBeNull();
    });
  });

  describe('useOtpSession', () => {
    it('hydrates the initial token value from the module-scoped storedToken', async () => {
      const { useOtpSession, setOtpSessionToken } = await freshSession();
      setOtpSessionToken('hydrated-tok');
      const { result } = renderHook(() => useOtpSession());
      expect(result.current.token).toBe('hydrated-tok');
    });

    it('storeToken updates both the module storage and the hook state', async () => {
      const { useOtpSession, getOtpSessionToken } = await freshSession();
      const { result } = renderHook(() => useOtpSession());
      expect(result.current.token).toBeNull();

      act(() => {
        result.current.storeToken('session-abc');
      });

      expect(result.current.token).toBe('session-abc');
      expect(getOtpSessionToken()).toBe('session-abc');
    });

    it('clearToken nulls out both the hook state and the module storage', async () => {
      const { useOtpSession, getOtpSessionToken, setOtpSessionToken } = await freshSession();
      setOtpSessionToken('seed');
      const { result } = renderHook(() => useOtpSession());
      expect(result.current.token).toBe('seed');

      act(() => {
        result.current.clearToken();
      });

      expect(result.current.token).toBeNull();
      expect(getOtpSessionToken()).toBeNull();
    });

    it('exposes stable callback identities across renders', async () => {
      const { useOtpSession } = await freshSession();
      const { result, rerender } = renderHook(() => useOtpSession());
      const firstStore = result.current.storeToken;
      const firstClear = result.current.clearToken;
      rerender();
      expect(result.current.storeToken).toBe(firstStore);
      expect(result.current.clearToken).toBe(firstClear);
    });
  });
});
