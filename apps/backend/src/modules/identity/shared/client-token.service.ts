import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';

export interface ClientTokenPair {
  accessToken: string;
  accessMaxAgeMs: number;
  rawRefresh: string;
  refreshMaxAgeMs: number;
}

export interface ClientJwtPayload {
  sub: string;
  email: string;
  namespace: 'client';
  jti: string;
  organizationId: string;
}

export interface ClientTenantClaims {
  organizationId: string;
}

function parseTtlMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * multipliers[match[2]];
}

@Injectable()
export class ClientTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(
    client: {
      id: string;
      email: string | null;
    },
    tenantClaims: ClientTenantClaims,
  ): Promise<ClientTokenPair> {
    const jti = randomUUID();
    const payload: ClientJwtPayload = {
      sub: client.id,
      email: client.email ?? '',
      namespace: 'client',
      jti,
      organizationId: tenantClaims.organizationId,
    };

    const accessTtl = (this.config.get<string>('JWT_CLIENT_ACCESS_TTL') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });
    const accessMaxAgeMs = parseTtlMs(accessTtl);

    const refreshTtl = this.config.get<string>('JWT_CLIENT_REFRESH_TTL') ?? '7d';
    const refreshMaxAgeMs = parseTtlMs(refreshTtl);

    const rawRefresh = randomUUID();
    const tokenSelector = rawRefresh.slice(0, 8);
    const tokenHash = await bcrypt.hash(rawRefresh, 10);
    const expiresAt = new Date(Date.now() + refreshMaxAgeMs);

    await this.prisma.clientRefreshToken.create({
      data: {
        clientId: client.id,
        tokenSelector,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, accessMaxAgeMs, rawRefresh, refreshMaxAgeMs };
  }

  verifyToken(token: string): ClientJwtPayload | null {
    try {
      return this.jwt.verify<ClientJwtPayload>(token, {
        secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
