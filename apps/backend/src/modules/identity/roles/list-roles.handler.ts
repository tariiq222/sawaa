import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class ListRolesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    return this.prisma.customRole.findMany({
      where: { organizationId },
      include: { permissions: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
