import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
@Injectable()
export class ClientLogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: { clientId, tokenSelector: selector, revokedAt: null },
    });

    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        const _revoked = await this.prisma.clientRefreshToken.update({
          where: { id: c.id },
          data: { revokedAt: new Date() },
        });

        return;
      }
    }
  }
}
