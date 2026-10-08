/** Authentication assurance follows both existing representations of super-admin authority. */
export function isEffectiveSuperAdmin(user: { role?: string | null; isSuperAdmin?: boolean | null }): boolean {
  return user.role === 'SUPER_ADMIN' || user.isSuperAdmin === true;
}
