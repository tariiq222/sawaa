import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GetBranchQuery = { branchId: string };

@Injectable()
export class GetBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GetBranchQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
      include: {
        businessHours: { orderBy: { dayOfWeek: 'asc' } },
        holidays: { orderBy: { date: 'asc' } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
