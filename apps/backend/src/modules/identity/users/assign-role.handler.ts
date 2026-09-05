import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { actorRankOf, targetRankOf } from '../shared/role-rank';

export interface AssignRoleCommand {
  // actorUserId comes from the authenticated principal (req.user.id), never the body.
  actorUserId: string;
  userId: string;
  customRoleId: string;
}

@Injectable()
export class AssignRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: AssignRoleCommand): Promise<void> {
    // No self-escalation: a user may not assign a (potentially privileged) custom
    // role to their own account. Cross-user custom-role permissions are bounded
    // by AssignPermissionsHandler validation.
    if (cmd.userId === cmd.actorUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const [actor, target] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: cmd.actorUserId }, select: { role: true, isSuperAdmin: true } }),
      this.prisma.user.findUnique({ where: { id: cmd.userId }, select: { role: true, isSuperAdmin: true } }),
    ]);
    if (!actor) throw new ForbiddenException('Actor not found');
    if (!target) throw new NotFoundException(`User ${cmd.userId} not found`);
    if (actorRankOf(actor) <= targetRankOf(target)) {
      throw new ForbiddenException('Cannot modify a user at or above your rank');
    }

    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    const { count } = await this.prisma.user.updateMany({
      where: { id: cmd.userId },
      data: { customRoleId: cmd.customRoleId, tokenVersion: { increment: 1 } },
    });
    if (count === 0) throw new NotFoundException(`User ${cmd.userId} not found`);
  }
}
