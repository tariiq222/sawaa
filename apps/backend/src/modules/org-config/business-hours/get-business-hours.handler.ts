import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GetBusinessHoursQuery = { branchId: string };

@Injectable()
export class GetBusinessHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GetBusinessHoursQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.businessHour.findMany({
      where: { branchId: dto.branchId, organizationId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
