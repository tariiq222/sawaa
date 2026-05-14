import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GetServiceCommand = { serviceId: string };

@Injectable()
export class GetServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GetServiceCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null, organizationId },
      include: {
        category: true,
        durationOptions: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
