import { Injectable } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import type { RequestMobileLoginOtpDto } from './request-mobile-login-otp.dto';

export type RequestMobileLoginOtpCommand = RequestMobileLoginOtpDto & {
  organizationId?: string;
  hCaptchaToken?: string;
};

export type RequestMobileLoginOtpResult = {
  maskedIdentifier: string;
};

@Injectable()
export class RequestMobileLoginOtpHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestOtp: RequestOtpHandler,
  ) {}

  async execute(cmd: RequestMobileLoginOtpCommand): Promise<RequestMobileLoginOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const where = channel === 'EMAIL' ? { email: identifier } : { phone: identifier };
    const user = await this.prisma.user.findFirst({
      where,
      select: { id: true, phoneVerifiedAt: true, emailVerifiedAt: true },
    });

    const shouldIssue =
      user !== null &&
      (channel === 'SMS' ? user.phoneVerifiedAt !== null : user.emailVerifiedAt !== null);

    if (shouldIssue) {
      await this.requestOtp.execute({
        identifier,
        channel: channel === 'SMS' ? OtpChannel.SMS : OtpChannel.EMAIL,
        purpose: OtpPurpose.MOBILE_LOGIN,
        organizationId: cmd.organizationId,
        hCaptchaToken: cmd.hCaptchaToken ?? 'mobile-app',
      });
    }

    return { maskedIdentifier: maskIdentifier(identifier, channel) };
  }
}

function maskIdentifier(value: string, channel: AuthChannel): string {
  if (channel === 'EMAIL') {
    const [local, domain] = value.split('@');
    if (!domain || !local || local.length < 2) return '***@***';
    return `${local[0]}***@${domain}`;
  }
  if (value.length < 6) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}
