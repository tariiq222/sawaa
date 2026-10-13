import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel, OtpPurpose, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

import { REVIEW_OTP_HASH_PATTERN, REVIEW_OTP_EMAIL } from './review-otp.policy';
type IdentityDb = Pick<Prisma.TransactionClient, 'client' | 'user'>;

/** Disabled unless an expiring private hash and the isolated review Client are configured. */
@Injectable()
export class ReviewOtpHandler {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async execute(cmd: { identifier: string; channel: OtpChannel; purpose: OtpPurpose }, db: IdentityDb = this.prisma) {
    if (cmd.channel !== OtpChannel.EMAIL || cmd.purpose !== OtpPurpose.MOBILE_LOGIN || cmd.identifier !== REVIEW_OTP_EMAIL) return null;
    const id = this.config.get<string>('MOBILE_REVIEW_CLIENT_ID');
    const codeHash = this.config.get<string>('MOBILE_REVIEW_OTP_HASH');
    const configuredExpiry = this.config.get<string | Date>('MOBILE_REVIEW_OTP_EXPIRES_AT');
    const expiresAt = configuredExpiry ? new Date(configuredExpiry) : new Date(NaN);
    if (!id || !codeHash || !REVIEW_OTP_HASH_PATTERN.test(codeHash) || !(expiresAt.getTime() > Date.now())) return null;

    const client = await db.client.findUnique({ where: { id } });
    if (!client || client.email !== REVIEW_OTP_EMAIL || !client.isActive || client.deletedAt || client.userId || client.phone ||
        !client.emailVerified || !client.passwordHash) return null;
    // An accidental staff/User collision must never acquire this synthetic login.
    if (await db.user.findFirst({ where: { email: REVIEW_OTP_EMAIL }, select: { id: true } })) return null;
    return { client, codeHash, expiresAt };
  }
}
