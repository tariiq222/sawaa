'use client';

import type { ClientProfile } from '@sawaa/shared';

const CLIENT_KEY = 'sawa_client';
const AUTH_SESSION_STATE_KEY = 'sawa_auth_session_state';
const LOCAL_SIGNED_OUT_COOKIE = 'sawa_local_signed_out';
const CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;
export type AuthSessionState = 'enabled' | 'logout-pending' | 'signed-out';

interface StoredClient {
  profile: ClientProfile;
  savedAt: number;
}

function readLocalStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    }
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function writeLocalSignedOutHint(signedOut: boolean): void {
  try {
    if (typeof document !== 'undefined') {
      document.cookie = signedOut
        ? `${LOCAL_SIGNED_OUT_COOKIE}=1; Path=/; Max-Age=86400; SameSite=Lax`
        : `${LOCAL_SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch {
    // The marker only prevents middleware redirect loops; auth still fails
    // closed when cookies are unavailable.
  }
}

// `undefined` = not yet loaded from localStorage; `null` = loaded and absent/expired.
let storedClient: ClientProfile | null | undefined = undefined;
let authGeneration = 0;
let authSessionState: AuthSessionState | undefined;
const authListeners = new Set<() => void>();

function publishAuthChange(): void {
  authListeners.forEach((listener) => listener());
}

function loadFromStorage(): ClientProfile | null {
  const raw = readLocalStorage(CLIENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredClient;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.savedAt !== 'number' ||
      !parsed.profile
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt >= CLIENT_CACHE_TTL_MS) {
      return null;
    }
    return parsed.profile;
  } catch {
    return null;
  }
}

export function setClient(client: ClientProfile | null): void {
  storedClient = client;
  if (client === null) {
    writeLocalStorage(CLIENT_KEY, null);
    publishAuthChange();
    return;
  }
  authSessionState = 'enabled';
  writeLocalStorage(AUTH_SESSION_STATE_KEY, null);
  writeLocalSignedOutHint(false);
  const payload: StoredClient = { profile: client, savedAt: Date.now() };
  writeLocalStorage(CLIENT_KEY, JSON.stringify(payload));
  publishAuthChange();
}

export function getClient(): ClientProfile | null {
  if (storedClient === undefined) {
    storedClient = loadFromStorage();
  }
  return storedClient;
}

export function clearAuth(): void {
  authGeneration += 1;
  setClient(null);
}

/**
 * Monotonic fence for async profile reads. A request started before logout
 * must not restore the browser-side session after local clearing.
 */
export function getAuthGeneration(): number {
  return authGeneration;
}

/**
 * Prevent cookie-backed profile reads after a local logout until an explicit
 * login stores a new client. The marker survives reloads while remote
 * revocation is still unknown.
 */
export function getAuthSessionStateSnapshot(): AuthSessionState {
  if (authSessionState === undefined) {
    const storedState = readLocalStorage(AUTH_SESSION_STATE_KEY);
    authSessionState = storedState === 'logout-pending' || storedState === 'signed-out'
      ? storedState
      : 'enabled';
  }
  return authSessionState;
}

export function getServerAuthSessionStateSnapshot(): AuthSessionState {
  // Defer cookie-backed auth reads until the browser snapshot can check the
  // durable local logout marker.
  return 'signed-out';
}

export function beginLocalLogout(): void {
  authSessionState = 'logout-pending';
  writeLocalStorage(AUTH_SESSION_STATE_KEY, authSessionState);
  clearAuth();
}

export function completeLocalLogout(): void {
  markSessionSignedOut();
}

export function expireLocalSession(): void {
  markSessionSignedOut();
  clearAuth();
}

function markSessionSignedOut(): void {
  authSessionState = 'signed-out';
  writeLocalStorage(AUTH_SESSION_STATE_KEY, authSessionState);
  writeLocalSignedOutHint(true);
  publishAuthChange();
}

export function getAuthIdentitySnapshot(): string | null {
  return getClient()?.id ?? null;
}

export function getServerAuthIdentitySnapshot(): null {
  return null;
}

export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function isAuthenticated(): boolean {
  return getClient() !== null;
}
