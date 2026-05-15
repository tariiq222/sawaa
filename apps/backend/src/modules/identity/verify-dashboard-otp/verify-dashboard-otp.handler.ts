import { Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService } from '../shared/token.service';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import { flattenPermissions } from '../casl/flatten-permissions';
import type { VerifyDashboardOtpCommand } from './verify-dashboard-otp.command';
import { DEFAULT_ORG_ID } from '../../../common/constants';

const LOCKOUT_WINDOW_MINUTES = 15;

interface AuthResponse {
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

export type VerifyDashboardOtpResult = AuthResponse;

@Injectable()
export class VerifyDashboardOtpHandler {
  private readonly logger = new Logger(VerifyDashboardOtpHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: VerifyDashboardOtpCommand): Promise<VerifyDashboardOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        identifier,
        purpose: OtpPurpose.DASHBOARD_LOGIN,
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

    const userWhere = channel === 'EMAIL' ? { email: identifier } : { phone: identifier };
    const user = await this.prisma.user.findFirst({
      where: userWhere,
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const tokens = await this.tokens.issueTokenPair(user, {
      organizationId: DEFAULT_ORG_ID,
      isSuperAdmin: user.isSuperAdmin ?? false,
    });

    const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);

    return {
      ...tokens,
      expiresIn: 900,
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
}