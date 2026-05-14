import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type ArchiveServiceCommand = { serviceId: string };

@Injectable()
export class ArchiveServiceHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: ArchiveServiceCommand) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, archivedAt: null, organizationId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.service.update({
      where: { id: dto.serviceId },
      data: { archivedAt: new Date(), isActive: false },
    });
  }
}
