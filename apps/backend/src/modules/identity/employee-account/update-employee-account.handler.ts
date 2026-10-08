import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { assertCanAssignRole, assertCanManageUser } from '../shared/role-rank';
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

    if (!cmd.actorUserId) throw new ForbiddenException('Actor not found');
    const actor = await this.prisma.user.findUnique({
      where: { id: cmd.actorUserId },
      select: { id: true, role: true, isSuperAdmin: true },
    });
    if (!actor) throw new ForbiddenException('Actor not found');
    const target = await this.prisma.user.findUnique({
      where: { id: employee.userId },
      select: { id: true, role: true, isSuperAdmin: true },
    });
    if (!target) throw new NotFoundException('User not found');
    assertCanManageUser(actor, target);
    if (cmd.role !== undefined) assertCanAssignRole(actor, cmd.role);

    return this.prisma.user.update({
      where: { id: employee.userId },
      data: { role: cmd.role, isActive: cmd.isActive },
      omit: { passwordHash: true },
    });
  }
}
