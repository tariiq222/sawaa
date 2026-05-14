import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { AssignPermissionsDto } from './assign-permissions.dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type AssignPermissionsCommand = AssignPermissionsDto & {
  customRoleId: string;
};

@Injectable()
export class AssignPermissionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: AssignPermissionsCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    // Verify the role belongs to the current org before we touch its permissions.
    const role = await this.prisma.customRole.findFirst({
      where: { id: cmd.customRoleId, organizationId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException(`Role ${cmd.customRoleId} not found`);

    await this.prisma.permission.deleteMany({ where: { customRoleId: cmd.customRoleId } });
    await this.prisma.permission.createMany({
      data: cmd.permissions.map((p) => ({
        customRoleId: cmd.customRoleId,
        organizationId,
        action: p.action,
        subject: p.subject,
      })),
    });
  }
}
