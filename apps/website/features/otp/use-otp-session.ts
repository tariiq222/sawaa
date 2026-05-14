'use client';

import { useState, useCallback } from 'react';

let storedToken: string | null = null;

export function setOtpSessionToken(token: string | null): void {
  storedToken = token;
}

export function getOtpSessionToken(): string | null {
  return storedToken;
}

export function useOtpSession() {
  const [token, setToken] = useState<string | null>(storedToken);

  const storeToken = useCallback((newToken: string | null) => {
    storedToken = newToken;
    setToken(newToken);
  }, []);

  const clearToken = useCallback(() => {
    storedToken = null;
    setToken(null);
  }, []);

  return { token, storeToken, clearToken };
}