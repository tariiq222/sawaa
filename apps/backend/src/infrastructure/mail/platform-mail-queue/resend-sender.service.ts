import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const DEFAULT_REPLY_TO = 'support@webvue.pro';

export interface ResendSendInput {
  to: string;
  from: string;
  subject: string;
  html: string;
}

/**
 * Thin Resend SDK wrapper used exclusively by the platform-mail BullMQ
 * worker. Throws on any error envelope so BullMQ schedules a retry.
 *
 * Tests: extracts the SDK behind a tiny seam; processor + service spec
 * mock this class instead of poking the global `resend` module.
 */
@Injectable()
export class ResendSenderService implements OnModuleInit {
  private readonly logger = new Logger(ResendSenderService.name);
  private client: Resend | null = null;
  private replyTo = DEFAULT_REPLY_TO;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.replyTo = this.config.get<string>('RESEND_REPLY_TO') ?? DEFAULT_REPLY_TO;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is required in production');
      }
      this.logger.warn(
        'RESEND_API_KEY not set — platform mail disabled (dev/test mode).',
      );
      return;
    }

    this.client = new Resend(apiKey);
    this.logger.log('ResendSenderService initialized');
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Send via Resend. Throws on any non-success outcome so BullMQ can retry.
   * - No client (dev/test, missing key) → throws so the job is retried/marked
   *   FAILED. (In production the constructor refuses to start without a key.)
   * - Resend error envelope → throws with the upstream message.
   * - Network/timeout → throws the original error.
   */
  async send(input: ResendSendInput): Promise<{ id: string | null }> {
    if (!this.client) {
      throw new Error(
        'PlatformMailer unavailable — RESEND_API_KEY missing (dev/test mode)',
      );
    }
    const res = await this.client.emails.send({
      from: input.from,
      replyTo: this.replyTo,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    });
    if (res.error) {
      throw new Error(`Resend send error: ${res.error.message}`);
    }
    return { id: res.data?.id ?? null };
  }
}
