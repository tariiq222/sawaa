// smtp-adapter — tenant-level SMTP via nodemailer (mirrors SmtpService but per-tenant).

import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailProvider, EmailSendPayload, EmailSendResult } from './email-provider.interface';

export type SmtpCredentials = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
};

export class SmtpEmailAdapter implements EmailProvider {
  readonly name = 'SMTP' as const;
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly creds: SmtpCredentials) {
    this.transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure ?? creds.port === 465,
      auth: { user: creds.user, pass: creds.pass },
      connectionTimeout: 10_000,  // 10s to establish TCP connection
      greetingTimeout: 8_000,     // 8s for server greeting (EHLO/HELO)
      socketTimeout: 10_000,      // 10s for socket inactivity (DATA command)
    });
  }

  isAvailable(): boolean {
    return true;
  }

  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const from =
      payload.fromName && payload.fromEmail
        ? `${payload.fromName} <${payload.fromEmail}>`
        : payload.fromEmail ?? this.creds.user;

    const info = await this.transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    this.logger.debug(`SMTP sent to ${payload.to}: ${String(info.messageId)}`);
    return { messageId: String(info.messageId) };
  }
}
