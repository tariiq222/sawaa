import { Injectable, Logger } from '@nestjs/common';
import { Client, Prisma, RefreshTokenSource } from '@prisma/client';
import { TokenService } from '../shared/token.service';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { ClientTokenService } from '../shared/client-token.service';
import { invalidCode, invalidFlow } from '../mobile-email-entry/mobile-email-errors';
import { MobilePhoneFlowStore, hashContinuation, newContinuation } from './mobile-phone-flow.store';
import { VerifyPhoneEntryDto } from './mobile-phone-entry.dto';

@Injectable()
export class VerifyPhoneEntryHandler {
  private readonly logger = new Logger(VerifyPhoneEntryHandler.name);
  constructor(private readonly store: MobilePhoneFlowStore, private readonly tokens: ClientTokenService,
    private readonly staffTokens: TokenService, private readonly settings: PlatformSettingsService) {}

  async execute(cmd: VerifyPhoneEntryDto) {
    const result = await this.store.transaction(async tx => {
      const flow = await this.store.lock(tx, cmd.challengeId);
      if (!flow || !this.store.liveFlow(flow) || flow.state !== 'CODE_PENDING') return { error: 'flow' as const };
      if (!/^\d{6}$/.test(cmd.code) || !await this.store.checkCode(tx, flow, cmd.code)) return { error: 'code' as const };
      const loadUsers = () => tx.user.findMany({ where: { phone: flow.phone }, include: { customRole: { include: { permissions: true } } } });
      const loadClients = () => tx.client.findMany({ where: { phone: flow.phone, deletedAt: null } });
      let users = await loadUsers();
      let clients = await loadClients();
      // Serialize contact/role changes with verification, then classify fresh rows.
      for (const id of [...new Set([...users.map(user => user.id), ...clients.flatMap(client => client.userId ? [client.userId] : [])])].sort()) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`);
      }
      for (const id of clients.map(client => client.id).sort()) {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${id} FOR UPDATE`);
      }
      users = await loadUsers();
      clients = await loadClients();
      const staff = users.length === 1 && users[0].role !== 'CLIENT' ? users[0] : undefined;
      if (staff) {
        const linkedClient = await tx.client.findFirst({ where: { userId: staff.id } });
        const eligible = staff.isActive && clients.length === 0 && !linkedClient &&
          await isMobileStaffEligible(tx, this.settings, staff);
        if (!await this.store.consume(tx, flow)) return { error: 'flow' as const };
        if (!eligible) return { next: 'unavailable' as const };
        return { next: 'authenticated' as const, sessionKind: 'staff' as const, emailPrompt: false,
          tokens: await this.staffTokens.issueTokenPair(staff, { isSuperAdmin: staff.isSuperAdmin }, tx, RefreshTokenSource.MOBILE) };
      }
      const candidate: Client | undefined = clients.length === 1 ? clients[0] : undefined;
      let unavailable = users.some(user => user.role !== 'CLIENT') || clients.length > 1;
      if (candidate) {
        unavailable ||= !candidate.isActive;
        if (candidate.userId) {
          const linked = await tx.user.findUnique({ where: { id: candidate.userId } });
          unavailable ||= !linked || linked.role !== 'CLIENT' || !linked.isActive;
        }
      } else unavailable ||= users.length > 0;
      const now = new Date();
      if (!candidate && !unavailable) {
        const continuationToken = newContinuation();
        await tx.mobilePhoneEntryFlow.update({ where: { id: flow.id }, data: {
          state: 'DETAILS_PENDING', codeHash: null,
          continuationHash: hashContinuation(continuationToken),
          continuationExpiresAt: new Date(Math.min(now.getTime() + 600000, flow.createdAt.getTime() + 900000)),
        } });
        return { next: 'register' as const, continuationToken, expiresIn: 600 };
      }
      if (!await this.store.consume(tx, flow)) return { error: 'flow' as const };
      if (unavailable || !candidate) return { next: 'unavailable' as const };
      const firstClaim = candidate.lastLoginAt === null && candidate.accountType === 'WALK_IN';
      const client = await tx.client.update({ where: { id: candidate.id }, data: { phoneVerified: candidate.phoneVerified ?? now, lastLoginAt: now } });
      const pair = await this.tokens.issueTokenPair(client, tx);
      return { next: 'authenticated' as const, sessionKind: 'client' as const,
        tokens: { accessToken: pair.accessToken, refreshToken: pair.rawRefresh },
        emailPrompt: candidate.emailVerified === null && !!candidate.email?.trim() && candidate.emailPromptResolvedAt === null,
        firstClaimClientId: firstClaim ? candidate.id : null };
    });
    // Error sentinels are deliberately handled AFTER commit (failed attempts persist).
    if ('error' in result) throw result.error === 'code' ? invalidCode() : invalidFlow();
    if ('firstClaimClientId' in result) {
      const { firstClaimClientId, ...response } = result;
      if (firstClaimClientId) this.logger.log({ event: 'mobile_phone_entry.first_claim', clientId: firstClaimClientId });
      return response;
    }
    return result;
  }
}
