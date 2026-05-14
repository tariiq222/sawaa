import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import type { LogoutCommand } from './logout.command';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: LogoutCommand): Promise<void> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    await this.prisma.refreshToken.updateMany({
      where: { userId: cmd.userId, organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: cmd.userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
