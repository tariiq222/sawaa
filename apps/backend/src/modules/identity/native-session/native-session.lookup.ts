import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database';

const userSelect = { id: true, userId: true, tokenHash: true, tokenSelector: true, expiresAt: true, revokedAt: true } as const;
const clientSelect = { id: true, clientId: true, tokenHash: true, tokenSelector: true, expiresAt: true, revokedAt: true } as const;
type NativeStore = Pick<PrismaService, 'refreshToken' | 'clientRefreshToken'>;
export type NativeRefreshTokenMatch =
  | ({ kind: 'user' } & Prisma.RefreshTokenGetPayload<{ select: typeof userSelect }>)
  | ({ kind: 'client' } & Prisma.ClientRefreshTokenGetPayload<{ select: typeof clientSelect }>);

@Injectable()
export class NativeSessionLookup {
  constructor(private readonly prisma: PrismaService) {}

  async find(rawToken: string, options: { activeOnly: boolean }, store: NativeStore = this.prisma): Promise<NativeRefreshTokenMatch | null> {
    if (typeof rawToken !== 'string' || rawToken.length < 8) return null;
    const common = options.activeOnly ? { revokedAt: null, expiresAt: { gt: new Date() } } : {};
    const [users, clients] = await Promise.all([
      store.refreshToken.findMany({ where: { tokenSelector: rawToken.slice(0, 8), ...common }, select: userSelect }),
      store.clientRefreshToken.findMany({ where: { tokenSelector: rawToken.slice(0, 8), ...common }, select: clientSelect }),
    ]);
    for (const candidate of users ?? []) {
      if (await bcrypt.compare(rawToken, candidate.tokenHash)) return { ...candidate, kind: 'user' };
    }
    for (const candidate of clients ?? []) {
      if (await bcrypt.compare(rawToken, candidate.tokenHash)) return { ...candidate, kind: 'client' };
    }
    return null;
  }
}
