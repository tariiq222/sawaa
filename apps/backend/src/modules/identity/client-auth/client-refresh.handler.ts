import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ClientTokenService } from '../shared/client-token.service';

@Injectable()
export class ClientRefreshHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly clientTokens: ClientTokenService,
  ) {}

  async execute(rawToken: string, clientId?: string, accessToken?: string) {
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

    // The refresh credential authenticates the client even after access expiry.
    // If a still-valid access credential is supplied, reject mixed identities.
    const access = accessToken ? this.clientTokens.verifyToken(accessToken) : null;
    if (access && (access.namespace !== 'client' || access.sub !== matched.clientId)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const resolvedClientId: string = matched.clientId;

    // Rotation is atomic with the session read. A password reset bumps
    // Client.tokenVersion and revokes every live refresh token inside its own
    // transaction; if this handler consumed the credential outside a
    // transaction, a reset landing in between would then be followed by a read
    // of the *new* version and a freshly inserted credential — the revocation
    // would be defeated (SEC-AUTH-02). Lock the Client first, exactly like
    // NativeRefreshHandler and the reset flow, then consume + read + insert.
    return this.rlsTransaction.withTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${resolvedClientId} FOR UPDATE`);

      const revoked = await tx.clientRefreshToken.updateMany({
        where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) {
        // Lost the rotation race — another request consumed this refresh token first.
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const client = await tx.client.findFirst({
        where: { id: resolvedClientId },
      });
      if (!client || !client.isActive || client.deletedAt) {
        throw new UnauthorizedException('Client not found or inactive');
      }

      // P1-7: carry the live tokenVersion through refresh so rotated access
      // tokens stay valid against the strategy's tokenVersion check.
      const tokens = await this.clientTokens.issueTokenPair({
        id: resolvedClientId,
        email: client.email,
        emailVerified: client.emailVerified,
        tokenVersion: client.tokenVersion,
      }, { channel: 'web' }, tx);

      return {
        clientId: resolvedClientId,
        accessToken: tokens.accessToken,
        accessMaxAgeMs: tokens.accessMaxAgeMs,
        refreshToken: tokens.rawRefresh,
        refreshMaxAgeMs: tokens.refreshMaxAgeMs,
      };
    });
  }
}
