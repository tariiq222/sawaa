import { Injectable } from '@nestjs/common';
import { Client, Prisma, User } from '@prisma/client';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { normalizeIdentifier } from '../shared/identifier-detector';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';

type AuthUser = Prisma.UserGetPayload<{ include: { customRole: { include: { permissions: true } } } }>;
export type EmailIdentity = { kind: 'register' } | { kind: 'unavailable' } | { kind: 'staff'; user: AuthUser }
  | { kind: 'client' | 'link'; user: AuthUser; client: Client }
  | { kind: 'clientOnly'; client: Client };
const canonical = (value: string) => normalizeIdentifier(value, 'EMAIL');

@Injectable()
export class MobileEmailIdentity {
  constructor(private readonly settings: PlatformSettingsService) {}

  async classify(tx: Prisma.TransactionClient, email: string): Promise<EmailIdentity> {
    const loadUsers = () => tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, include: { customRole: { include: { permissions: true } } } });
    let users = await loadUsers();
    for (const id of users.map(u => u.id).sort()) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`);
    users = await loadUsers();
    const loadClients = () => tx.client.findMany({ where: { OR: [{ email: { equals: email, mode: 'insensitive' } }, { userId: { in: users.map(u => u.id) } }] } });
    let clients = await loadClients();
    for (const id of clients.map(c => c.id).sort()) await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${id} FOR UPDATE`);
    clients = await loadClients();
    if (users.length === 0 && clients.length === 0) return { kind: 'register' };
    if (users.length === 0) {
      // A Client-only account (phone-first registration or a legacy record) may
      // sign in with its email ONLY after that exact address was proven on the
      // account itself. Unverified, inactive, deleted or ambiguous rows never
      // authenticate and are never adopted.
      const live = clients.filter(c => c.deletedAt === null);
      const client = live.length === 1 ? live[0] : undefined;
      if (!client || client.userId || !client.isActive || !client.emailVerified || !client.email || canonical(client.email) !== email) {
        return { kind: 'unavailable' };
      }
      return { kind: 'clientOnly', client };
    }
    if (users.length !== 1 || !users[0].isActive) return { kind: 'unavailable' };
    const user = users[0];
    if (canonical(user.email) !== email) return { kind: 'unavailable' };
    if (user.role !== 'CLIENT') {
      if (clients.length || !user.emailVerifiedAt || !await isMobileStaffEligible(tx, this.settings, user)) return { kind: 'unavailable' };
      return { kind: 'staff', user };
    }
    if (user.isSuperAdmin || clients.length !== 1) return { kind: 'unavailable' };
    const client = clients[0];
    if (client.userId !== user.id || !client.isActive || client.deletedAt || (client.email && canonical(client.email) !== email)) return { kind: 'unavailable' };
    if (user.phone && client.phone && user.phone !== client.phone) return { kind: 'unavailable' };
    if (user.emailVerifiedAt) return { kind: 'client', user, client };
    if (!user.phone || user.phone !== client.phone || !user.phoneVerifiedAt || !client.phoneVerified) return { kind: 'unavailable' };
    const [phoneUsers, phoneClients] = await Promise.all([
      tx.user.findMany({ where: { phone: user.phone }, select: { id: true } }),
      tx.client.findMany({ where: { phone: user.phone }, select: { id: true } }),
    ]);
    if (phoneUsers.length !== 1 || phoneUsers[0].id !== user.id || phoneClients.length !== 1 || phoneClients[0].id !== client.id) return { kind: 'unavailable' };
    return { kind: 'link', user, client };
  }

  snapshot(user: User, client: Client): Prisma.InputJsonObject {
    return {
      user: { id: user.id, email: user.email, phone: user.phone, role: user.role, isSuperAdmin: user.isSuperAdmin, tokenVersion: user.tokenVersion,
        isActive: user.isActive, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null, phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null, updatedAt: user.updatedAt.toISOString() },
      client: { id: client.id, userId: client.userId, email: client.email, phone: client.phone, tokenVersion: client.tokenVersion, isActive: client.isActive,
        deletedAt: client.deletedAt?.toISOString() ?? null, emailVerified: client.emailVerified?.toISOString() ?? null, phoneVerified: client.phoneVerified?.toISOString() ?? null, updatedAt: client.updatedAt.toISOString() },
    };
  }

  async contactsFree(tx: Prisma.TransactionClient, email: string, phone: string): Promise<boolean> {
    const where = { OR: [{ email: { equals: email, mode: 'insensitive' as const } }, { phone }] };
    const [users, clients] = await Promise.all([tx.user.findMany({ where, select: { id: true } }), tx.client.findMany({ where, select: { id: true } })]);
    return users.length === 0 && clients.length === 0;
  }
}
