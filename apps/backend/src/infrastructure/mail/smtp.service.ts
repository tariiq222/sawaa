import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface ISmtpService {
  sendMail(to: string, subject: string, html: string, from?: string): Promise<void>;
  sendBulk(recipients: Array<{ to: string; subject: string; html: string }>, from?: string): Promise<void>;
  isAvailable(): boolean;
}

@Injectable()
export class SmtpService implements ISmtpService, OnModuleInit {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: Transporter | null = null;
  private defaultFrom = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST not set — email sending disabled');
      return;
    }

    this.defaultFrom = this.config.get<string>('SMTP_FROM') ?? '';

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    this.logger.log('SMTP transporter initialized');
  }

  isAvailable(): boolean {
    return this.transporter !== null;
  }

  async sendMail(to: string, subject: string, html: string, from?: string): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP is not initialized');
    }

    await this.transporter.sendMail({
      from: from ?? this.defaultFrom,
      to,
      subject,
      html,
    });
  }

  async sendBulk(
    recipients: Array<{ to: string; subject: string; html: string }>,
    from?: string,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP is not initialized');
    }

    await Promise.all(recipients.map((r) => this.sendMail(r.to, r.subject, r.html, from)));
  }
}
