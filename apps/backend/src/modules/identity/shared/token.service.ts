import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';
import { SINGLE_TENANT_CONTEXT_ID } from '../../../common/constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Legacy tenant identity merged into the JWT payload for API compatibility.
 * Single-tenant mode ignores caller-supplied organizationId and stamps the
 * fixed deployment context while keeping the claim present for old clients.
 */
export interface TenantClaims {
  /** @deprecated Ignored in single-tenant mode; use SINGLE_TENANT_CONTEXT_ID internally. */
  organizationId: string;
  isSuperAdmin?: boolean;
  scope?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  customRoleId: string | null;
  permissions: Array<{ action: string; subject: string }>;
  features: string[];
  organizationId?: string;
  isSuperAdmin?: boolean;
  scope?: string;
  // P0-6: Session invalidation via tokenVersion. If the JWT's tokenVersion
  // does not match the User.tokenVersion in the DB, the session is stale.
  tokenVersion?: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(
    user: {
      id: string;
      email: string;
      role: string;
      customRoleId: string | null;
      customRole: { permissions: Array<{ action: string; subject: string }> } | null;
      tokenVersion: number;
    },
    _tenantClaims: TenantClaims,
  ): Promise<TokenPair> {
    const permissions = user.customRole?.permissions ?? [];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions,
      features: [],
      organizationId: SINGLE_TENANT_CONTEXT_ID,
      isSuperAdmin: _tenantClaims.isSuperAdmin ?? false,
      scope: _tenantClaims.scope,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
    });

    const rawRefresh = randomUUID();
    const tokenSelector = rawRefresh.slice(0, 8);
    const tokenHash = await bcrypt.hash(rawRefresh, 10);
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenSelector,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * multipliers[match[2]];
  }
}
