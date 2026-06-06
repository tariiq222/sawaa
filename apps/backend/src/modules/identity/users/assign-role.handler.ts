import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

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

    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    const { count } = await this.prisma.user.updateMany({
      where: { id: cmd.userId },
      data: { customRoleId: cmd.customRoleId },
    });
    if (count === 0) throw new NotFoundException(`User ${cmd.userId} not found`);
  }
}
