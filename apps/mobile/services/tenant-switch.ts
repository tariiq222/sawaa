import { setSecureItem } from '@/stores/secure-storage';
import { setCurrentOrgId } from './tenant';
import { setOrganizationId, setUser } from '@/stores/slices/auth-slice';
import { store } from '@/stores/store';
import { queryClient } from './query-client';
import { authService } from './auth';
import type { SwitchOrgTokens } from './memberships';

/**
 * Persist new tokens, swap the active org id, refetch the profile from
 * `/auth/me` so the user's role/permissions reflect the NEW tenant, and wipe
 * TanStack caches so the next render fetches data scoped to the new tenant.
 *
 * Refetching the profile is critical: the post-switch redirect (root `/` →
 * `app/index.tsx`) must see the fresh role to pick the right surface. Without
 * this step, a multi-tenant user whose role differs across orgs would be
 * routed using their pre-switch role.
 */
export async function applyTenantSwitch(
  organizationId: string,
  tokens: SwitchOrgTokens,
): Promise<void> {
  await setSecureItem('accessToken', tokens.accessToken);
  await setSecureItem('refreshToken', tokens.refreshToken);
  await setCurrentOrgId(organizationId);
  store.dispatch(setOrganizationId(organizationId));
  queryClient.clear();
  // Refresh user so the next role-based redirect is accurate for the new org.
  try {
    const profileRes = await authService.getProfile();
    if (profileRes.success && profileRes.data) {
      store.dispatch(setUser(profileRes.data));
    }
  } catch {
    // Non-fatal: caller falls through to root which will re-hydrate.
  }
}
