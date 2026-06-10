import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { SendEmailQueueService } from '../../comms/send-email/send-email-queue.service';
import { maskEmail } from '../../../common/helpers/mask-pii.helper';

const TOKEN_TTL_MS = 30 * 60 * 1000;
const EMAIL_TEMPLATE_SLUG = 'user_email_verification';

export interface RequestEmailVerificationCommand {
  userId: string;
  organizationId?: string;
}

export interface RequestEmailVerificationResult {
  success: boolean;
}

@Injectable()
export class RequestEmailVerificationHandler {
  private readonly logger = new Logger(RequestEmailVerificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sendEmailQueue: SendEmailQueueService,
    private readonly config: ConfigService,
  ) {}

  async execute(cmd: RequestEmailVerificationCommand): Promise<RequestEmailVerificationResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      this.logger.log(`Email already verified for user ${user.id} — no-op`);
      return { success: true };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenSelector = rawToken.slice(0, 8);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        tokenSelector,
        expiresAt,
      },
    });

    const baseUrl =
      this.config.get<string>('PUBLIC_WEBSITE_URL') ??
      this.config.get<string>('WEBSITE_URL') ??
      'http://localhost:5205';
    const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;

    // Enqueued (BullMQ) instead of sent inline — the request must not block
    // on the email provider round-trip. SendEmailWorker delivers with retries.
    await this.sendEmailQueue.enqueue({
      to: user.email,
      templateSlug: EMAIL_TEMPLATE_SLUG,
      vars: {
        userName: user.name,
        verifyUrl,
        subject: 'Verify your Sawaa email',
      },
    });

    this.logger.log(`Email verification link queued for ${maskEmail(user.email)}`);
    return { success: true };
  }
}
