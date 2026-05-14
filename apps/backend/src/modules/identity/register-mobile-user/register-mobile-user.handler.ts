import { Injectable, ConflictException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';
import { normalizeIdentifier } from '../shared/identifier-detector';
import type { RegisterMobileUserDto } from './register-mobile-user.dto';

export type RegisterMobileUserCommand = RegisterMobileUserDto & {
  organizationId?: string;
  hCaptchaToken?: string;
};

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

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { email }] },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Account already exists');
    }

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
      },
    });

    await this.requestOtp.execute({
      channel: OtpChannel.SMS,
      identifier: phone,
      purpose: OtpPurpose.MOBILE_REGISTER,
      hCaptchaToken: cmd.hCaptchaToken ?? 'mobile-app',
      organizationId: cmd.organizationId,
    });

    return {
      userId: user.id,
      maskedPhone: maskPhone(phone),
    };
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}
