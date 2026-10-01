import { Injectable, ConflictException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';
import { normalizeIdentifier } from '../shared/identifier-detector';
import type { RegisterMobileUserDto } from './register-mobile-user.dto';

export type RegisterMobileUserCommand = RegisterMobileUserDto;

export type RegisterMobileUserResult = {
  userId: string;
  maskedPhone: string;
};

@Injectable()
export class RegisterMobileUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestOtp: RequestOtpHandler,
  ) {}

  async execute(cmd: RegisterMobileUserCommand): Promise<RegisterMobileUserResult> {
    const phone = normalizeIdentifier(cmd.phone, 'SMS');
    const email = normalizeIdentifier(cmd.email, 'EMAIL');

    const matches = await this.prisma.user.findMany({
      where: { OR: [{ phone }, { email }] },
      select: {
        id: true,
        phone: true,
        role: true,
        isActive: true,
        isSuperAdmin: true,
        phoneVerifiedAt: true,
        passwordHash: true,
      },
    });

    let userId: string;
    if (matches.length === 0) {
      const user = await this.prisma.user.create({
        data: {
          firstName: cmd.firstName,
          lastName: cmd.lastName,
          name: `${cmd.firstName} ${cmd.lastName}`.trim(),
          phone,
          email,
          passwordHash: null,
          phoneVerifiedAt: null,
          emailVerifiedAt: null,
          isActive: false,
          // SECURITY (P0-1): mobile self-signup MUST NOT default to RECEPTIONIST.
          // Force CLIENT role so admin JwtStrategy refuses these tokens.
          role: 'CLIENT',
        },
      });
      userId = user.id;
    } else {
      // Retry of an unfinished self-signup: the only match is the pending
      // CLIENT row created earlier for this same phone (never verified, never
      // activated, no password). Anything else — a verified/active account, a
      // staff role, a phone mismatch, or the email owned by another user —
      // stays a conflict with the same generic message.
      const pending = matches.length === 1 && isPendingSelfSignup(matches[0], phone) ? matches[0] : null;
      if (!pending) {
        throw new ConflictException('Account already exists');
      }
      await this.prisma.user.update({
        where: { id: pending.id },
        data: {
          firstName: cmd.firstName,
          lastName: cmd.lastName,
          name: `${cmd.firstName} ${cmd.lastName}`.trim(),
          email,
        },
      });
      userId = pending.id;
    }

    await this.requestOtp.execute({
      channel: OtpChannel.SMS,
      identifier: phone,
      purpose: OtpPurpose.MOBILE_REGISTER,
    });

    return {
      userId,
      maskedPhone: maskPhone(phone),
    };
  }
}

type ExistingUserMatch = {
  phone: string | null;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  phoneVerifiedAt: Date | null;
  passwordHash: string | null;
};

function isPendingSelfSignup(user: ExistingUserMatch, phone: string): boolean {
  return (
    user.phone === phone &&
    user.role === 'CLIENT' &&
    !user.isActive &&
    !user.isSuperAdmin &&
    user.phoneVerifiedAt === null &&
    user.passwordHash === null
  );
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
