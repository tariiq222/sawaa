import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { assertCanManageUser } from './role-rank';

/** Authorize employee links and authentication-email writes against current account ranks. */
export async function assertCanManageEmployeeUser(
  db: { user: Pick<Prisma.TransactionClient['user'], 'findUnique'> },
  actorUserId: string | undefined,
  targetUserId: string,
): Promise<void> {
  if (!actorUserId) throw new ForbiddenException('Actor not found');
  const actor = await db.user.findUnique({
    where: { id: actorUserId }, select: { id: true, role: true, isSuperAdmin: true },
  });
  if (!actor) throw new ForbiddenException('Actor not found');
  const target = await db.user.findUnique({
    where: { id: targetUserId }, select: { id: true, role: true, isSuperAdmin: true },
  });
  if (!target) throw new NotFoundException('User not found');
  assertCanManageUser(actor, target);
}
