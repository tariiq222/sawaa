import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { ClientTokenService } from '../shared/client-token.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';

@Injectable()
export class ClientRefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientTokens: ClientTokenService,
  ) {}

  async execute(rawToken: string, clientId: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.clientRefreshToken.findMany({
      where: {
        clientId,
        tokenSelector: selector,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let matched: (typeof candidates)[0] | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) {
        matched = c;
        break;
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    const revoked = await this.prisma.clientRefreshToken.updateMany({
      where: { id: matched.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      // Lost the rotation race — another request consumed this refresh token first.
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: clientId },
    });
    if (!client || !client.isActive || client.deletedAt) {
      throw new UnauthorizedException('Client not found or inactive');
    }

    const tokens = await this.clientTokens.issueTokenPair(
      { id: clientId, email: client.email },
      { organizationId: DEFAULT_ORG_ID },
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefresh,
    };
  }
}
