import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma, RefreshTokenSource } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { TokenPair, TokenService } from '../shared/token.service';
import { ClientTokenService } from '../shared/client-token.service';
import { NativeSessionLookup } from './native-session.lookup';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';

@Injectable()
export class NativeRefreshHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly tokens: TokenService,
    private readonly clientTokens: ClientTokenService,
    private readonly lookup: NativeSessionLookup,
    private readonly settings: PlatformSettingsService,
  ) {}

  async execute(rawToken: string): Promise<TokenPair> {
    const matched = await this.lookup.find(rawToken, { activeOnly: true });
    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    const result = await this.rlsTransaction.withTransaction(async (tx): Promise<TokenPair | 'ineligible'> => {
      if (matched.kind === 'client') {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${matched.clientId} FOR UPDATE`);
        const client = await tx.client.findUnique({ where: { id: matched.clientId } });
        if (!client || !client.isActive || client.deletedAt) throw new UnauthorizedException('Client not found or inactive');
        const consumed = await tx.clientRefreshToken.updateMany({
          where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { revokedAt: new Date() },
        });
        if (consumed.count !== 1) throw new UnauthorizedException('Invalid or expired refresh token');
        const next = await this.clientTokens.issueTokenPair({ id: client.id, email: client.email, tokenVersion: client.tokenVersion }, tx);
        return { accessToken: next.accessToken, refreshToken: next.rawRefresh };
      }

      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${matched.userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: matched.userId }, include: { customRole: { include: { permissions: true } } } });
      // Legacy mobile CLIENT users used the staff refresh table. Never exchange
      // that credential into a Client JWT; require a fresh OTP proof instead.
      if (!user || !user.isActive || user.role === 'CLIENT') throw new UnauthorizedException('User not found or inactive');
      // Staff mobile sessions follow the same eligibility as mobile OTP login.
      // Revoke the presented token so an ineligible session cannot be retried.
      if (!await isMobileStaffEligible(tx, this.settings, user)) {
        await tx.refreshToken.updateMany({ where: { id: matched.id, revokedAt: null }, data: { revokedAt: new Date() } });
        return 'ineligible';
      }
      const consumed = await tx.refreshToken.updateMany({
        where: { id: matched.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (consumed.count !== 1) throw new UnauthorizedException('Invalid or expired refresh token');
      return this.tokens.issueTokenPair(user, { isSuperAdmin: user.isSuperAdmin ?? false }, tx, RefreshTokenSource.MOBILE);
    });
    if (result === 'ineligible') throw new UnauthorizedException('User not found or inactive');
    return result;
  }
}
