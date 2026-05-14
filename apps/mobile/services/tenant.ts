import { TENANT_ID as DEFAULT_TENANT_ID } from '@/constants/config';
import {
  deleteSecureItem,
  getSecureItem,
  setSecureItem,
} from '@/stores/secure-storage';

const TENANT_KEY = 'currentOrgId';

let cachedOrgId: string | null = null;
let loaded = false;

/**
 * Synchronous accessor for the request interceptor. Returns the org id loaded
 * by `loadCurrentOrgId()` at boot, or the build-time default if nothing is
 * stored (first install / pre-login state).
 */
export function getCurrentOrgIdSync(): string {
  return cachedOrgId ?? DEFAULT_TENANT_ID;
}

/**
 * Hydrate the in-memory cache from secure storage. Call once at app boot
 * before any authenticated request fires.
 */
export async function loadCurrentOrgId(): Promise<string> {
  if (loaded) return getCurrentOrgIdSync();
  try {
    const stored = await getSecureItem(TENANT_KEY);
    cachedOrgId = stored && stored.length > 0 ? stored : null;
  } catch {
    cachedOrgId = null;
  }
  loaded = true;
  return getCurrentOrgIdSync();
}

/**
 * Persist + cache the active org id. Called on login / register / OTP verify
 * once the JWT is in hand and we know which tenant owns this session.
 */
export async function setCurrentOrgId(orgId: string): Promise<void> {
  cachedOrgId = orgId;
  loaded = true;
  await setSecureItem(TENANT_KEY, orgId);
}

/**
 * Wipe the active org id on logout / org suspension. Subsequent public
 * requests fall back to the build-time default tenant.
 */
export async function clearCurrentOrgId(): Promise<void> {
  cachedOrgId = null;
  loaded = true;
  await deleteSecureItem(TENANT_KEY);
}

/** Test-only: reset module state between cases. */
export function __resetTenantCacheForTests(): void {
  cachedOrgId = null;
  loaded = false;
}
