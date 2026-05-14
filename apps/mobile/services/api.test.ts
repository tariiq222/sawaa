jest.mock('@/stores/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn() }));
jest.mock('@/stores/secure-storage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn(),
  deleteSecureItem: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

import api from './api';
import { TENANT_ID } from '@/constants/config';
import {
  __resetTenantCacheForTests,
  setCurrentOrgId,
} from './tenant';

async function runRequestInterceptors(initial: { headers: Record<string, string> }) {
  let config: any = initial;
  const handlers = (api.interceptors.request as any).handlers as Array<{
    fulfilled: (c: any) => Promise<any> | any;
  }>;
  for (const h of handlers) {
    if (h && typeof h.fulfilled === 'function') {
      config = await h.fulfilled(config);
    }
  }
  return config;
}

describe('api request interceptor — X-Org-Id', () => {
  beforeEach(() => {
    __resetTenantCacheForTests();
  });

  it('falls back to build-time TENANT_ID when no tenant has been persisted', async () => {
    const config = await runRequestInterceptors({ headers: {} });
    expect(config.headers['X-Org-Id']).toBe(TENANT_ID);
  });

  it('uses the org id set by setCurrentOrgId (post-login)', async () => {
    const orgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await setCurrentOrgId(orgId);
    const config = await runRequestInterceptors({ headers: {} });
    expect(config.headers['X-Org-Id']).toBe(orgId);
  });
});
