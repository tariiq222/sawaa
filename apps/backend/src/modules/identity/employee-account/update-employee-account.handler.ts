import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { assertCanAssignRole } from '../shared/role-rank';
import { UpdateEmployeeAccountDto } from './update-employee-account.dto';

// actorUserId is injected from the authenticated principal (req.user.id), never the body.
export type UpdateEmployeeAccountCommand = UpdateEmployeeAccountDto & {
  employeeId: string;
  actorUserId: string;
};

@Injectable()
export class UpdateEmployeeAccountHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmployeeAccountCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!employee.userId) {
      throw new NotFoundException('Employee has no linked account');
    }

    // No self-escalation: cannot re-role your own linked account through this path.
    if (employee.userId === cmd.actorUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Rank gate (only when a built-in role change is requested — role is optional here).
    if (cmd.role !== undefined) {
      const actor = await this.prisma.user.findUnique({
        where: { id: cmd.actorUserId },
        select: { role: true, isSuperAdmin: true },
      });
      if (!actor) throw new ForbiddenException('Actor not found');
      assertCanAssignRole(actor, cmd.role);
    }

    return this.prisma.user.update({
      where: { id: employee.userId },
      data: { role: cmd.role, isActive: cmd.isActive },
      omit: { passwordHash: true },
    });
  }
}
