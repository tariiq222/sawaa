import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { flattenPermissions } from '../casl/flatten-permissions';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    gender: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    role: string;
    isSuperAdmin: boolean;
    firstName: string;
    lastName: string;
    organizationId: string | null;
    permissions: string[];
  };
}

@Injectable()
export class AuthResponseBuilder {
  constructor(private readonly config: ConfigService) {}

  build(
    tokens: { accessToken: string; refreshToken: string },
    user: User & { customRole: { permissions: { action: string; subject: string }[] } | null },
  ): AuthResponse {
    const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);
    const ttl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';

    return {
      ...tokens,
      expiresIn: this.parseTtlSeconds(ttl),
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? '',
        phone: user.phone,
        gender: user.gender ?? null,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin ?? false,
        firstName,
        lastName: rest.join(' '),
        organizationId: DEFAULT_ORG_ID,
        permissions: flattenPermissions({
          role: user.role,
          customRole: user.customRole,
        }),
      },
    };
  }

  private parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * multipliers[match[2]];
  }
}
