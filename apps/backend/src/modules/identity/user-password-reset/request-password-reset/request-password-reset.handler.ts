import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../../../infrastructure/database';
import { SendEmailQueueService } from '../../../comms/send-email/send-email-queue.service';
import { RequestPasswordResetDto } from './request-password-reset.dto';
import { maskEmail } from '../../../../common/helpers/mask-pii.helper';

const TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class RequestPasswordResetHandler {
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendEmailQueue: SendEmailQueueService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: RequestPasswordResetDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      this.logger.log('Password reset requested for unknown or inactive account');
      return;
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenSelector = rawToken.slice(0, 8);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenSelector,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl =
      this.config.get<string>('PASSWORD_RESET_BASE_URL') ??
      this.config.get<string>('DASHBOARD_URL') ??
      'http://localhost:5203';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    // Enqueued (BullMQ) instead of sent inline — the request must not block
    // on the email provider round-trip. SendEmailWorker delivers with retries.
    await this.sendEmailQueue.enqueue({
      to: user.email,
      templateSlug: 'user_password_reset',
      vars: {
        userName: user.name,
        resetUrl,
        subject: 'Reset your Sawaa password',
      },
    });

    this.logger.log(`Password reset email queued for ${maskEmail(user.email)}`);
  }
}
