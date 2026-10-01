import { ConflictException, Injectable } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';
import { detectChannel, normalizeIdentifier, AuthChannel } from '../shared/identifier-detector';
import type { RequestMobileLoginOtpDto } from './request-mobile-login-otp.dto';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { isMobileStaffEligible } from '../shared/mobile-staff-eligibility';

export type RequestMobileLoginOtpCommand = RequestMobileLoginOtpDto;

export type RequestMobileLoginOtpResult = {
  maskedIdentifier: string;
};

@Injectable()
export class RequestMobileLoginOtpHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestOtp: RequestOtpHandler,
    private readonly settings: PlatformSettingsService,
  ) {}

  async execute(cmd: RequestMobileLoginOtpCommand): Promise<RequestMobileLoginOtpResult> {
    const channel: AuthChannel = detectChannel(cmd.identifier);
    const identifier = normalizeIdentifier(cmd.identifier, channel);

    const where = channel === 'EMAIL' ? { email: identifier } : { phone: identifier };
    const user = await this.prisma.user.findFirst({
      where,
      select: { id: true, role: true, isActive: true, isSuperAdmin: true, phoneVerifiedAt: true, emailVerifiedAt: true },
    });

    const linkedEmailClients = channel === 'EMAIL' && user?.role === 'CLIENT'
      ? ((await this.prisma.client.findMany({ where: { userId: user.id } })) ?? [])
      : [];
    const emailConflicts = channel === 'EMAIL' && user?.role === 'CLIENT'
      ? ((await this.prisma.client.findMany({ where: { email: identifier } })) ?? [])
          .filter((candidate) => candidate.userId !== user.id)
      : [];
    if (emailConflicts.length > 0) {
      throw new ConflictException('Client identity conflict: email belongs to another customer');
    }
    if (channel === 'EMAIL' && user?.role === 'CLIENT' && linkedEmailClients.length > 0 &&
        (linkedEmailClients.length !== 1 || !linkedEmailClients[0].isActive || linkedEmailClients[0].deletedAt !== null)) {
      throw new ConflictException('Client identity conflict: email customer link is ambiguous or inactive');
    }

    const clientCandidates = channel === 'SMS'
      ? ((await this.prisma.client.findMany({ where: { phone: identifier } })) ?? [])
      : [];
    if (clientCandidates.length > 1) {
      throw new ConflictException('Client identity conflict: phone matches multiple customers');
    }
    const client = clientCandidates[0];

    const shouldIssue =
      (user !== null && user.isActive &&
        (channel === 'SMS'
          ? user.phoneVerifiedAt !== null
          : user.emailVerifiedAt !== null && (user.role !== 'CLIENT' || linkedEmailClients.length === 1))) ||
      (client !== undefined && client.isActive && client.deletedAt === null &&
        channel === 'SMS');

    // Staff who cannot finish a mobile OTP login (see VerifyMobileOtpHandler)
    // get the same generic response without a code.
    const staffBlocked = shouldIssue && user !== null && user.role !== 'CLIENT' && !await isMobileStaffEligible(this.prisma, this.settings, user);

    if (shouldIssue && !staffBlocked) {
      await this.requestOtp.execute({
        identifier,
        channel: channel === 'SMS' ? OtpChannel.SMS : OtpChannel.EMAIL,
        purpose: OtpPurpose.MOBILE_LOGIN,
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
