import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService, TokenPair } from '../shared/token.service';
import type { RefreshTokenCommand } from './refresh-token.command';

@Injectable()
export class RefreshTokenHandler {
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: RefreshTokenCommand): Promise<TokenPair> {
    // tokenSelector = first 8 chars of the UUID refresh token (set by TokenService.issueTokenPair).
    // Use it for an O(1) indexed lookup instead of scanning all active tokens for the user.
    const selector = cmd.rawToken.length >= 8 ? cmd.rawToken.slice(0, 8) : null;

    let matched: { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null } | undefined;

    if (selector) {
      // ── Fast path (new format: all tokens issued by TokenService have a selector) ──
      const candidate = await this.prisma.refreshToken.findFirst({
        where: {
          userId: cmd.userId,
          tokenSelector: selector,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (candidate) {
        // Selector matched — if bcrypt also fails this is a bad/forged token, not
        // a legacy one. Throw immediately; do NOT fall through to the O(n) scan.
        if (!(await bcrypt.compare(cmd.rawToken, candidate.tokenHash))) {
          throw new UnauthorizedException('Invalid or expired refresh token');
        }
        matched = candidate;
      }
    }

    if (!matched) {
      // ── Legacy path (tokens issued before tokenSelector column was populated) ──
      // Fallback to full scan; only reached for tokens older than the migration.
      // These naturally expire within the refresh TTL (default 30d).
      this.logger.warn(
        `Falling back to legacy O(n) token scan for user ${cmd.userId} — ` +
          `selector=${selector ?? 'none'} (token predates tokenSelector column or did not match)`,
      );
      const candidates = await this.prisma.refreshToken.findMany({
        where: { userId: cmd.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      for (const c of candidates) {
        if (await bcrypt.compare(cmd.rawToken, c.tokenHash)) {
          matched = c;
          break;
        }
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired refresh token');

    // Conditional revoke: if a concurrent request already consumed this token,
    // updateMany with `revokedAt: null` will affect 0 rows and we reject —
    // mirrors the safe pattern in client-refresh.handler.ts. Plain update()
    // is unconditional and would let two parallel /auth/refresh calls each
    // mint a fresh token pair from the same one-time refresh token.
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: matched.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    return this.tokens.issueTokenPair(user, {
      isSuperAdmin: user.isSuperAdmin ?? false,
    });
  }
}
