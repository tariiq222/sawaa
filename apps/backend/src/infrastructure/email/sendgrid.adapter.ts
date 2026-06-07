// sendgrid-adapter — deployment-level email via SendGrid API.

import { Logger } from '@nestjs/common';
import type { EmailProvider, EmailSendPayload, EmailSendResult } from './email-provider.interface';
import { fetchWithTimeout } from '../http';

export type SendGridCredentials = {
  apiKey: string;
};

export class SendGridEmailAdapter implements EmailProvider {
  readonly name = 'SENDGRID' as const;
  private readonly logger = new Logger(SendGridEmailAdapter.name);

  constructor(private readonly creds: SendGridCredentials) {}

  isAvailable(): boolean {
    return true;
  }

  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const fromEmail = payload.fromEmail ?? 'noreply@sawaa.sa';
    const fromName = payload.fromName;

    const res = await fetchWithTimeout(
      'https://api.sendgrid.com/v3/mail/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: fromName
            ? { email: fromEmail, name: fromName }
            : { email: fromEmail },
          subject: payload.subject,
          content: [{ type: 'text/html', value: payload.html }],
        }),
      },
      8_000,
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SendGrid API error ${res.status}: ${body}`);
    }

    // SendGrid returns 202 with X-Message-Id header
    const messageId = res.headers.get('X-Message-Id') ?? 'sendgrid-ok';
    this.logger.debug(`SendGrid sent to ${payload.to}: ${messageId}`);
    return { messageId };
  }
}
