import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type DeleteDepartmentCommand = { departmentId: string };

@Injectable()
export class DeleteDepartmentHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: DeleteDepartmentCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const result = await this.prisma.department.deleteMany({
      where: { id: dto.departmentId, organizationId },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    return { deleted: true };
  }
}
