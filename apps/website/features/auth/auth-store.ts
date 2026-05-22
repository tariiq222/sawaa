'use client';

import type { ClientProfile } from '@sawaa/shared';

const CLIENT_KEY = 'sawa_client';
const CLIENT_CACHE_TTL_MS = 15 * 60 * 1000;

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

// `undefined` = not yet loaded from localStorage; `null` = loaded and absent/expired.
let storedClient: ClientProfile | null | undefined = undefined;

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
    return;
  }
  const payload: StoredClient = { profile: client, savedAt: Date.now() };
  writeLocalStorage(CLIENT_KEY, JSON.stringify(payload));
}

export function getClient(): ClientProfile | null {
  if (storedClient === undefined) {
    storedClient = loadFromStorage();
  }
  return storedClient;
}

export function clearAuth(): void {
  storedClient = null;
  writeLocalStorage(CLIENT_KEY, null);
}

export function isAuthenticated(): boolean {
  return getClient() !== null;
}
