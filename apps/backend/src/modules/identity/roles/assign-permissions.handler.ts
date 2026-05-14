import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsDto } from './assign-permissions.dto';

export type AssignPermissionsCommand = AssignPermissionsDto & {
  customRoleId: string;
};

@Injectable()
export class AssignPermissionsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: AssignPermissionsCommand): Promise<void> {
    // Verify the role exists before we touch its permissions.
    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    await this.prisma.permission.deleteMany({ where: { customRoleId: cmd.customRoleId } });
    await this.prisma.permission.createMany({
      data: cmd.permissions.map((p) => ({
        customRoleId: cmd.customRoleId,
        action: p.action,
        subject: p.subject,
      })),
    });
  }
}
