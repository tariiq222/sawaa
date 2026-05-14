import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformMailQueueService } from './platform-mail-queue/platform-mail-queue.service';

const DEFAULT_FROM = 'Sawaa <noreply@webvue.pro>';

/**
 * Public façade for platform-level transactional emails.
 * All sends are enqueued via BullMQ — Resend is called by the worker
 * (see PlatformMailProcessor), NOT inline.
 */
@Injectable()
export class PlatformMailerService implements OnModuleInit {
  private readonly logger = new Logger(PlatformMailerService.name);
  private from = DEFAULT_FROM;

  constructor(
    private readonly config: ConfigService,
    private readonly queue: PlatformMailQueueService,
  ) {}

  onModuleInit(): void {
    this.from = this.config.get<string>('RESEND_FROM') ?? DEFAULT_FROM;
    this.logger.log('PlatformMailerService initialized (queue-backed)');
  }

  // ── Public send API ────────────────────────────────────────────────────────

  async sendOtpLogin(
    to: string,
    vars: import('./templates/otp-login.template').OtpLoginVars,
  ): Promise<void> {
    const { otpLoginTemplate } = await import('./templates/otp-login.template');
    const t = otpLoginTemplate(vars);
    await this.dispatch('otp-login', to, this.bilingualSubject(t.subjectAr, t.subjectEn), t.html);
  }

  /**
   * Send a raw email with full control over to/subject/html.
   * Used by the platform email test-send endpoint.
   */
  async sendRaw(opts: { to: string; subject: string; html: string; templateSlug: string }): Promise<void> {
    await this.dispatch(opts.templateSlug, opts.to, opts.subject, opts.html);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private bilingualSubject(ar: string, en: string): string {
    return `${ar} · ${en}`;
  }

  private async dispatch(
    templateName: string,
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.queue.enqueue({
      recipient: to,
      templateName,
      subject,
      html,
      from: this.from,
    });
  }
}
