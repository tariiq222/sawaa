import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class ListRolesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    return this.prisma.customRole.findMany({
      include: { permissions: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
