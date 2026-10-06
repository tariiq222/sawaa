// mailchimp-adapter — deployment-level transactional email via Mailchimp Transactional (Mandrill).

import { Logger } from '@nestjs/common';
import { emailHttpFailure, EmailProviderRejectedError } from './email-provider.interface';
import type { EmailProvider, EmailSendPayload, EmailSendResult } from './email-provider.interface';
import { fetchWithTimeout } from '../http';

export type MailchimpCredentials = {
  /** Mailchimp Transactional (Mandrill) API key */
  apiKey: string;
};

export class MailchimpEmailAdapter implements EmailProvider {
  readonly name = 'MAILCHIMP' as const;
  private readonly logger = new Logger(MailchimpEmailAdapter.name);

  constructor(private readonly creds: MailchimpCredentials) {}

  isAvailable(): boolean {
    return true;
  }

  async sendMail(payload: EmailSendPayload): Promise<EmailSendResult> {
    const fromEmail = payload.fromEmail ?? 'noreply@sawaa.sa';
    const fromName = payload.fromName ?? '';

    const res = await fetchWithTimeout(
      'https://mandrillapp.com/api/1.0/messages/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: this.creds.apiKey,
          message: {
            html: payload.html,
            subject: payload.subject,
            from_email: fromEmail,
            from_name: fromName,
            to: [{ email: payload.to, type: 'to' }],
          },
        }),
      },
      8_000,
    );

    if (!res.ok) {
      throw emailHttpFailure('Mailchimp Transactional', res.status);
    }

    const data = (await res.json()) as Array<{ _id?: string; status?: string }>;
    const first = data[0];
    if (!first) throw new Error('Mailchimp returned empty response');
    if (first.status === 'rejected' || first.status === 'invalid') {
      throw new EmailProviderRejectedError(`Mailchimp rejected message: ${first.status}`);
    }

    const messageId = first._id ?? 'mailchimp-ok';
    this.logger.debug('Email accepted by provider');
    return { messageId };
  }
}
