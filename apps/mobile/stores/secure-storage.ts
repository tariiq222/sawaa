import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Storage } from 'redux-persist';

const isWeb = Platform.OS === 'web';

/**
 * Cross-platform secure storage.
 * Uses expo-secure-store on native, sessionStorage on web.
 * Note: sessionStorage is preferred over localStorage for tokens
 * because it clears on tab close, reducing XSS exposure window.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    return sessionStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    sessionStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    sessionStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Sanitize keys for SecureStore (only alphanumeric, ".", "-", "_" allowed).
 * Redux Persist uses "persist:auth" — the colon is invalid.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Redux-persist storage engine.
 */
const secureStorage: Storage = {
  getItem: (key: string) => getSecureItem(sanitizeKey(key)),
  setItem: (key: string, value: string) => setSecureItem(sanitizeKey(key), value),
  removeItem: (key: string) => deleteSecureItem(sanitizeKey(key)),
};

export default secureStorage;
