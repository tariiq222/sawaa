import { Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';
import { TokenService, TokenPair } from '../shared/token.service';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import { MobileOtpPurposeDto, VerifyMobileOtpDto } from './verify-mobile-otp.dto';

const LOCKOUT_WINDOW_MINUTES = 10;

export type VerifyMobileOtpCommand = VerifyMobileOtpDto;

export interface VerifyMobileOtpActiveMembership {
  id: string;
  organizationId: string;
  role: string;
}

export interface VerifyMobileOtpResult {
  tokens: TokenPair;
  activeMembership: VerifyMobileOtpActiveMembership | null;
}

@Injectable()
export class VerifyMobileOtpHandler {
  private readonly logger = new Logger(VerifyMobileOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly cls: ClsService,
  ) {}

  async execute(cmd: VerifyMobileOtpCommand): Promise<VerifyMobileOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);
    const otpChannel: OtpChannel = channel === 'EMAIL' ? OtpChannel.EMAIL : OtpChannel.SMS;
    const otpPurpose: OtpPurpose =
      cmd.purpose === MobileOtpPurposeDto.REGISTER ? OtpPurpose.MOBILE_REGISTER : OtpPurpose.MOBILE_LOGIN;

    const userWhere = channel === 'EMAIL' ? { email: identifier } : { phone: identifier };
    const user = await this.prisma.user.findFirst({
      where: userWhere,
      include: { customRole: { include: { permissions: true } } },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    return this.cls.run(async () => {
      this.logger.warn('systemContext bypass activated', { context: 'VerifyMobileOtpHandler' });
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);

      const otpRecord = await this.prisma.otpCode.findFirst({
        where: {
          identifier,
          channel: otpChannel,
          purpose: otpPurpose,
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otpRecord) {
        throw new BadRequestException('Invalid or expired code');
      }

      const now = new Date();
      if (otpRecord.expiresAt <= now) {
        throw new BadRequestException('Invalid or expired code');
      }
      if (otpRecord.lockedUntil && otpRecord.lockedUntil > now) {
        throw new BadRequestException('OTP_LOCKED_OUT');
      }
      if (otpRecord.attempts >= otpRecord.maxAttempts) {
        throw new BadRequestException('Too many failed attempts. Please request a new code.');
      }

      const codeMatch = await bcrypt.compare(cmd.code, otpRecord.codeHash);
      if (!codeMatch) {
        const nextAttempts = otpRecord.attempts + 1;
        const shouldLock = nextAttempts >= otpRecord.maxAttempts;
        await this.prisma.otpCode.update({
          where: { id: otpRecord.id },
          data: {
            attempts: { increment: 1 },
            ...(shouldLock
              ? { lockedUntil: new Date(now.getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000) }
              : {}),
          },
        });
        throw new UnauthorizedException('Invalid OTP code');
      }

      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { consumedAt: new Date() },
      });

      let tokenUser = user;
      if (cmd.purpose === MobileOtpPurposeDto.REGISTER) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { phoneVerifiedAt: new Date(), isActive: true },
          include: { customRole: { include: { permissions: true } } },
        });
        tokenUser = updated;
      } else {
        if (!user.isActive) throw new UnauthorizedException('Account is inactive');
      }

      const tokens = await this.tokens.issueTokenPair(tokenUser, {
        organizationId: DEFAULT_ORGANIZATION_ID,
        isSuperAdmin: false,
      });

      return {
        tokens,
        activeMembership: null,
      };
    });
  }
}
