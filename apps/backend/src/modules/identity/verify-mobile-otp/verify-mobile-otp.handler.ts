import { Injectable, BadRequestException, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose, Prisma, RefreshTokenSource } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { TokenService, TokenPair } from '../shared/token.service';
import { ClientTokenService } from '../shared/client-token.service';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import { MobileOtpPurposeDto, VerifyMobileOtpDto } from './verify-mobile-otp.dto';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';

const LOCKOUT_WINDOW_MINUTES = 10;
export type VerifyMobileOtpCommand = VerifyMobileOtpDto;
export type MobileSessionKind = 'client' | 'staff';
export interface VerifyMobileOtpResult { tokens: TokenPair; sessionKind?: MobileSessionKind; }

type ClientIdentity = {
  id: string; userId: string | null; email: string | null; phone: string | null;
  isActive: boolean; deletedAt: Date | null; phoneVerified?: Date | null; tokenVersion: number;
  name?: string; firstName?: string | null; lastName?: string | null;
};

@Injectable()
export class VerifyMobileOtpHandler {
  private readonly logger = new Logger(VerifyMobileOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly clientTokens: ClientTokenService,
    private readonly cls: ClsService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settings: PlatformSettingsService,
  ) {}

  async execute(cmd: VerifyMobileOtpCommand): Promise<VerifyMobileOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);
    const otpChannel = channel === 'EMAIL' ? OtpChannel.EMAIL : OtpChannel.SMS;
    const otpPurpose = cmd.purpose === MobileOtpPurposeDto.REGISTER ? OtpPurpose.MOBILE_REGISTER : OtpPurpose.MOBILE_LOGIN;

    const result = await this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'VerifyMobileOtpHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.rlsTransaction.withTransaction(async (tx) => {
        const initialUser = await tx.user.findFirst({
          where: channel === 'EMAIL' ? { email: identifier } : { phone: identifier },
          include: { customRole: { include: { permissions: true } } },
        });
        if (cmd.purpose === MobileOtpPurposeDto.REGISTER && (channel !== 'SMS' || !initialUser || initialUser.role !== 'CLIENT' || initialUser.phoneVerifiedAt != null)) {
          throw new UnauthorizedException('Registration requires a customer phone OTP');
        }
        let user = initialUser;
        let client: ClientIdentity | null = null;
        if (user) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`);
          const lockedUser = await tx.user.findUnique({ where: { id: user.id }, include: { customRole: { include: { permissions: true } } } });
          if (!lockedUser) throw new ConflictException('Client identity conflict: customer account disappeared');
          user = lockedUser;
          if (cmd.purpose === MobileOtpPurposeDto.REGISTER && (user.role !== 'CLIENT' || user.phoneVerifiedAt != null || user.isActive)) {
            throw new UnauthorizedException('Registration requires a customer account');
          }
          if (cmd.purpose === MobileOtpPurposeDto.LOGIN && !user.isActive) throw new UnauthorizedException('Account is inactive');
          if (channel === 'SMS' && user.phone !== identifier) throw new ConflictException('Client identity conflict: verified phone changed');
          if (channel === 'EMAIL' && user.email !== identifier) throw new ConflictException('Client identity conflict: verified email changed');
          if (user.role === 'CLIENT') client = await this.resolveUserClient(tx, user.id, channel, identifier);
        } else if (!user && channel === 'SMS') {
          client = await this.resolvePhoneClient(tx, identifier);
        }
        if (!user && !client) throw new UnauthorizedException('Invalid credentials');
        if (user?.role === 'CLIENT' && !client && cmd.purpose !== MobileOtpPurposeDto.REGISTER && channel !== 'SMS') {
          throw new ConflictException('Client identity conflict: customer link is required');
        }
        if (client) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Client" WHERE "id" = ${client.id} FOR UPDATE`);
          const lockedClient = await tx.client.findUnique({ where: { id: client.id } });
          if (!lockedClient) throw new ConflictException('Client identity conflict: customer record disappeared');
          client = lockedClient as ClientIdentity;
          if (!client.isActive || client.deletedAt) throw new UnauthorizedException('Account is inactive');
          if (channel === 'SMS' && client.phone !== identifier) throw new ConflictException('Client identity conflict: verified phone changed');
          if (channel === 'EMAIL' && user?.role === 'CLIENT' && client.userId !== user.id) {
            throw new ConflictException('Client identity conflict: customer link changed');
          }
        }

        const otpRecord = await tx.otpCode.findFirst({
          where: { identifier, channel: otpChannel, purpose: otpPurpose, consumedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        const now = new Date();
        if (!otpRecord) throw new BadRequestException('Invalid or expired code');
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "OtpCode" WHERE "id" = ${otpRecord.id} FOR UPDATE`);
        const lockedOtp = await tx.otpCode.findFirst({ where: { id: otpRecord.id } });
        if (!lockedOtp) throw new ConflictException('OTP identity conflict: code disappeared');
        const currentOtp = lockedOtp;
        const lockedNow = new Date();
        if (currentOtp.consumedAt || currentOtp.expiresAt <= lockedNow || (currentOtp.lockedUntil && currentOtp.lockedUntil > lockedNow)) {
          throw new BadRequestException('Invalid or expired code');
        }
        if (currentOtp.attempts >= currentOtp.maxAttempts) throw new BadRequestException('Too many failed attempts. Please request a new code.');
        if (!await bcrypt.compare(cmd.code, currentOtp.codeHash)) {
          const nextAttempts = currentOtp.attempts + 1;
          await tx.otpCode.update({
            where: { id: currentOtp.id },
            data: { attempts: { increment: 1 }, ...(nextAttempts >= currentOtp.maxAttempts ? { lockedUntil: new Date(lockedNow.getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000) } : {}) },
          });
          return { kind: 'wrong-code' as const };
        }

        // Checked only after the code matches, so the response cannot reveal a
        // staff account's role or practitioner link, and before consumption.
        if (cmd.purpose === MobileOtpPurposeDto.LOGIN && user && user.role !== 'CLIENT' &&
            !await isMobileStaffEligible(tx, this.settings, user)) {
          throw new UnauthorizedException('Invalid credentials');
        }

        const consumed = await tx.otpCode.updateMany({
          where: { id: otpRecord.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: new Date() },
        });
        if (consumed.count !== 1) throw new BadRequestException('Invalid or expired code');

        if (user?.role === 'CLIENT') {
          const emailMatches = user.email
            ? ((await tx.client.findMany({ where: { email: user.email } })) ?? [])
            : [];
          if (emailMatches.some((match) => match.id !== client?.id && match.userId !== user!.id)) {
            throw new ConflictException('Client identity conflict: email belongs to another customer');
          }
        }

        if (cmd.purpose === MobileOtpPurposeDto.REGISTER) {
          if (!user) throw new UnauthorizedException('Invalid credentials');
          const updated = await tx.user.update({
            where: { id: user.id }, data: { phoneVerifiedAt: new Date(), isActive: true },
            include: { customRole: { include: { permissions: true } } },
          });
          client = await this.ensureRegisteredClient(tx, updated, identifier, client);
        } else if (user && user.role !== 'CLIENT') {
          if (!user.isActive) throw new UnauthorizedException('Account is inactive');
          return { tokens: await this.tokens.issueTokenPair(user, { isSuperAdmin: user.isSuperAdmin ?? false }, tx, RefreshTokenSource.MOBILE), sessionKind: 'staff' as const };
        }
        if (cmd.purpose === MobileOtpPurposeDto.LOGIN && user?.role === 'CLIENT' && channel === 'SMS') {
          client = await this.ensureRegisteredClient(tx, user, identifier, client);
        }
        if (!client) throw new ConflictException('Client identity conflict: customer record is required');
        if (channel === 'SMS' && !client.phoneVerified) {
          client = await tx.client.update({ where: { id: client.id }, data: { phoneVerified: new Date() } }) as ClientIdentity;
        }
        return {
          tokens: await this.toNativeTokens(await this.clientTokens.issueTokenPair({ id: client.id, email: client.email, tokenVersion: client.tokenVersion }, tx)),
          sessionKind: 'client' as const,
        };
      });
    });
    if ('kind' in result && result.kind === 'wrong-code') throw new UnauthorizedException('Invalid OTP code');
    return result;
  }

  private async toNativeTokens(pair: { accessToken: string; rawRefresh: string }): Promise<TokenPair> {
    return { accessToken: pair.accessToken, refreshToken: pair.rawRefresh };
  }

  private async resolveUserClient(tx: Prisma.TransactionClient, userId: string, channel: AuthChannel, identifier: string): Promise<ClientIdentity | null> {
    const linked = (await tx.client.findMany({ where: { userId } })) ?? [];
    if (linked.length > 1) throw new ConflictException('Client identity conflict: multiple customer links');
    if (linked[0]) {
      const candidate = linked[0] as ClientIdentity;
      if (candidate.deletedAt || !candidate.isActive) throw new ConflictException('Client identity conflict: customer is disabled');
      if (channel === 'SMS' && candidate.phone && candidate.phone !== identifier) {
        throw new ConflictException('Client identity conflict: linked phone differs');
      }
      return candidate;
    }
    if (channel !== 'SMS') return null;
    const phoneMatch = await this.resolvePhoneClient(tx, identifier);
    if (phoneMatch?.userId && phoneMatch.userId !== userId) {
      throw new ConflictException('Client identity conflict: phone belongs to another customer');
    }
    return phoneMatch;
  }

  private async resolvePhoneClient(tx: Prisma.TransactionClient, phone: string): Promise<ClientIdentity | null> {
    const candidates = (await tx.client.findMany({ where: { phone } })) ?? [];
    if (candidates.length > 1) throw new ConflictException('Client identity conflict: phone matches multiple customers');
    return (candidates[0] as ClientIdentity | undefined) ?? null;
  }

  private async ensureRegisteredClient(tx: Prisma.TransactionClient, user: { id: string; firstName?: string | null; lastName?: string | null; name: string }, phone: string, linked: ClientIdentity | null): Promise<ClientIdentity> {
    if (linked && linked.phone && linked.phone !== phone) throw new ConflictException('Client identity conflict: linked phone differs');
    const existing = linked ?? await this.resolvePhoneClient(tx, phone);
    if (existing?.userId && existing.userId !== user.id) throw new ConflictException('Client identity conflict: phone belongs to another customer');
    if (existing) {
      if (existing.deletedAt || !existing.isActive) throw new ConflictException('Client identity conflict: customer is disabled');
      if (existing.userId === user.id && existing.phone === phone) return existing;
      return tx.client.update({ where: { id: existing.id }, data: { userId: user.id, phoneVerified: new Date() } }) as Promise<ClientIdentity>;
    }
    return tx.client.create({ data: { userId: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, phone, phoneVerified: new Date(), accountType: 'FULL', claimedAt: new Date() } }) as Promise<ClientIdentity>;
  }
}
