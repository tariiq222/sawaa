'use client';

import type { ClientProfile } from '@deqah/shared';

let storedAccessToken: string | null = null;
let storedRefreshToken: string | null = null;
let storedClient: ClientProfile | null = null;

export function getAccessToken(): string | null {
  return storedAccessToken;
}

export function getRefreshToken(): string | null {
  return storedRefreshToken;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  storedAccessToken = accessToken;
  storedRefreshToken = refreshToken;
}

export function setClient(client: ClientProfile | null): void {
  storedClient = client;
}

export function getClient(): ClientProfile | null {
  return storedClient;
}

export function clearAuth(): void {
  storedAccessToken = null;
  storedRefreshToken = null;
  storedClient = null;
}

export function isAuthenticated(): boolean {
  return storedAccessToken !== null && storedClient !== null;
}
