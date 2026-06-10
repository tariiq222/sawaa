import { Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { TokenService } from '../shared/token.service';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import { flattenPermissions } from '../casl/flatten-permissions';
import type { VerifyDashboardOtpCommand } from './verify-dashboard-otp.command';

const LOCKOUT_WINDOW_MINUTES = 15;

/**
 * Windowed failed-verify lockout, keyed by the normalized identifier (NOT by
 * OTP row). The per-row `attempts`/`maxAttempts` tracking below still exists,
 * but on its own it can be bypassed: requesting a fresh OTP creates a new row
 * with attempts=0, resetting the attacker's guess budget. This Redis counter
 * survives OTP re-issuance — max N failed verifies per identifier per
 * 15-minute window, regardless of how many new codes are requested.
 * Shared with RequestDashboardOtpHandler, which refuses to issue new codes
 * while the identifier is locked out.
 */
export const MAX_FAILED_VERIFY_ATTEMPTS = 5;
export const FAILED_VERIFY_WINDOW_SECONDS = LOCKOUT_WINDOW_MINUTES * 60;
export const dashboardOtpFailedKey = (identifier: string): string =>
  `dashboard_otp:failed:${identifier}`;

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
    private readonly redis: RedisService,
  ) {}

  async execute(cmd: VerifyDashboardOtpCommand): Promise<VerifyDashboardOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const redisClient = this.redis.getClient();
    const failedKey = dashboardOtpFailedKey(identifier);
    const windowFailures = Number((await redisClient.get(failedKey)) ?? 0);
    if (windowFailures >= MAX_FAILED_VERIFY_ATTEMPTS) {
      // Identifier-level lockout wins over everything — even a fresh, correct
      // code is rejected while the window counter is at max.
      throw new BadRequestException('OTP_LOCKED_OUT');
    }

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
      // Atomic INCR + EXPIRE via multi/exec (same pattern as login.handler
      // P2-10) so a crash between incr and expire never leaves a key without
      // TTL, and parallel wrong-code attempts cannot race each other.
      await redisClient
        .multi()
        .incr(failedKey)
        .expire(failedKey, FAILED_VERIFY_WINDOW_SECONDS)
        .exec();

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

    // Successful verify clears the windowed failure counter.
    await redisClient.del(failedKey);

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
        permissions: flattenPermissions({
          role: user.role,
          customRole: user.customRole,
        }),
      },
    };
  }
}