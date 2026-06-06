import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ROLE_RANK, actorRankOf } from '../shared/role-rank';

export interface UpdateUserRoleCommand {
  actorUserId: string;
  targetUserId: string;
  role?: UserRole;
  customRoleId?: string | null;
}

@Injectable()
export class UpdateUserRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: UpdateUserRoleCommand) {
    if (cmd.actorUserId === cmd.targetUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }
    if (cmd.role === undefined && cmd.customRoleId === undefined) {
      throw new BadRequestException('Must provide role or customRoleId');
    }

    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: cmd.actorUserId },
        select: { id: true, role: true, isSuperAdmin: true },
      }),
      this.prisma.user.findUnique({
        where: { id: cmd.targetUserId },
        select: { id: true, role: true },
      }),
    ]);
    if (!actor) throw new ForbiddenException('Actor not found');
    if (!target) throw new NotFoundException('User not found');

    // Only SUPER_ADMIN can grant SUPER_ADMIN. All other rank checks below.
    if (cmd.role === 'SUPER_ADMIN' && !actor.isSuperAdmin) {
      throw new ForbiddenException('Only super admins can grant SUPER_ADMIN');
    }

    const actorRank = actorRankOf(actor);
    const targetCurrentRank = ROLE_RANK[target.role];
    if (actorRank <= targetCurrentRank) {
      throw new ForbiddenException('Cannot modify a user at or above your rank');
    }
    if (cmd.role !== undefined) {
      const targetNewRank = ROLE_RANK[cmd.role];
      if (actorRank <= targetNewRank) {
        throw new ForbiddenException('Cannot assign a role at or above your rank');
      }
    }

    // If granting a customRole, verify it exists. We do not block by rank because
    // customRole permissions are bounded by AssignPermissionsHandler validation.
    if (cmd.customRoleId !== undefined && cmd.customRoleId !== null) {
      const exists = await this.prisma.customRole.findUnique({
        where: { id: cmd.customRoleId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Custom role not found');
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: cmd.targetUserId },
        data: {
          ...(cmd.role !== undefined ? { role: cmd.role } : {}),
          ...(cmd.customRoleId !== undefined ? { customRoleId: cmd.customRoleId } : {}),
          // Bump tokenVersion to invalidate any cached tokens with old permissions.
          tokenVersion: { increment: 1 },
        },
        omit: { passwordHash: true },
      });
      return updated;
    });
  }
}
