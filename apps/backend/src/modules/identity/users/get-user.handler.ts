import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface GetUserQuery {
  userId: string;
}

@Injectable()
export class GetUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async execute(query: GetUserQuery) {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
      omit: { passwordHash: true },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
