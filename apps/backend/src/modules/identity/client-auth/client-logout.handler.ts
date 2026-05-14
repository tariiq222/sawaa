import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

@Injectable()
export class ClientLogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { clientId, organizationId, tokenSelector: selector, revokedAt: null },
    });

    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        const revoked = await this.prisma.clientRefreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });

        return;
      }
    }
  }
}
