import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Built-in role power ranking. Higher number = more powerful.
 * An actor may only assign a role strictly below their own rank, and only a
 * SUPER_ADMIN may grant SUPER_ADMIN. Shared by every role-mutation path so the
 * rank gate is defined exactly once.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  ACCOUNTANT: 50,
  RECEPTIONIST: 40,
  EMPLOYEE: 30,
  CLIENT: 10,
};

/** Effective rank of an actor — super admins always top out at SUPER_ADMIN. */
export function actorRankOf(actor: { role: UserRole; isSuperAdmin: boolean }): number {
  return actor.isSuperAdmin ? ROLE_RANK.SUPER_ADMIN : ROLE_RANK[actor.role];
}

/**
 * Guard a built-in role assignment against horizontal/vertical privilege
 * escalation. Throws ForbiddenException if the actor is trying to grant a role
 * at or above their own rank, or to grant SUPER_ADMIN without being one.
 */
export function assertCanAssignRole(
  actor: { role: UserRole; isSuperAdmin: boolean },
  newRole: UserRole,
): void {
  if (newRole === 'SUPER_ADMIN' && !actor.isSuperAdmin) {
    throw new ForbiddenException('Only super admins can grant SUPER_ADMIN');
  }
  // A super admin granting SUPER_ADMIN is the one legitimate "at your own rank"
  // grant — it is already vetted by the guard above and is the only way another
  // super admin can ever be minted. Every other actor stays bound by the strict
  // "at or above your rank" rule (so an ADMIN still cannot grant ADMIN, etc.).
  const grantingSuperAdmin = newRole === 'SUPER_ADMIN' && actor.isSuperAdmin;
  if (!grantingSuperAdmin && actorRankOf(actor) <= ROLE_RANK[newRole]) {
    throw new ForbiddenException('Cannot assign a role at or above your rank');
  }
}
