import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { flattenPermissions } from '../casl/flatten-permissions';

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
    permissions: string[];
  };
}

@Injectable()
export class AuthResponseBuilder {
  constructor(private readonly config: ConfigService) {}

  build(
    tokens: { accessToken: string; refreshToken: string },
    user: User & { customRole: { permissions: { action: string; subject: string }[] } | null },
    // P1-8: DB-stored permissions for the user's built-in system role. When
    // present they override the hardcoded BUILT_IN map, exactly as JwtStrategy
    // does — keeping the returned permissions[] in sync with enforcement.
    systemRolePermissions?: Array<{ action: string; subject: string }> | null,
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
        permissions: flattenPermissions({
          role: user.role,
          customRole: user.customRole,
          systemRolePermissions: systemRolePermissions ?? null,
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
