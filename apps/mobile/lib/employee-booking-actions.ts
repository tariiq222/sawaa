import type { User } from '@/types/auth';

/** UI capability hints from flattenPermissions; the API remains authoritative. */
export function hasBookingPermission(user: Pick<User, 'permissions' | 'isSuperAdmin'> | null, action: 'update' | 'delete'): boolean {
  return !!user && (user.isSuperAdmin || ['*', 'booking:*', `booking:${action}`, `*:${action}`]
    .some((permission) => user.permissions?.includes(permission)));
}

export function resolveCancellationMode(user: Pick<User, 'permissions' | 'isSuperAdmin'> | null) {
  if (hasBookingPermission(user, 'delete')) return 'direct_cancel';
  if (hasBookingPermission(user, 'update')) return 'request_cancel';
  return 'none';
}
