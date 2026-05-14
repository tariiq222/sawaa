import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { toListResponse } from '../../../common/dto';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface ListUsersQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class ListUsersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async execute(query: ListUsersQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const where = {
      memberships: { some: { organizationId, isActive: true } },
      isActive: query.isActive,
      ...(query.search
        ? { OR: [{ name: { contains: query.search, mode: 'insensitive' as const } }, { email: { contains: query.search, mode: 'insensitive' as const } }] }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' }, omit: { passwordHash: true } }),
      this.prisma.user.count({ where }),
    ]);

    return toListResponse(items, total, query.page, query.limit);
  }
}
