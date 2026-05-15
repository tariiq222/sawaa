'use client';

import type { ClientProfile } from '@sawaa/shared';

const CLIENT_KEY = 'sawa_client';

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

let storedClient: ClientProfile | null = (() => {
  const raw = readLocalStorage(CLIENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientProfile;
  } catch {
    return null;
  }
})();

export function setClient(client: ClientProfile | null): void {
  storedClient = client;
  writeLocalStorage(CLIENT_KEY, client ? JSON.stringify(client) : null);
}

export function getClient(): ClientProfile | null {
  return storedClient;
}

export function clearAuth(): void {
  storedClient = null;
  writeLocalStorage(CLIENT_KEY, null);
}

export function isAuthenticated(): boolean {
  return storedClient !== null;
}
