import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UnassignEmployeeFromBranchCommand = {
  branchId: string;
  employeeId: string;
};

@Injectable()
export class UnassignEmployeeFromBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UnassignEmployeeFromBranchCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const link = await this.prisma.employeeBranch.findFirst({
      where: {
        branchId: dto.branchId,
        employeeId: dto.employeeId,
      },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Assignment not found');

    await this.prisma.employeeBranch.delete({ where: { id: link.id } });
    return { id: link.id };
  }
}
