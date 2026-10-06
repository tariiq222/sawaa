// email-provider — shared email provider contract (mirrors sms-provider.interface.ts pattern).

type EmailProviderName = 'NONE' | 'SMTP' | 'RESEND' | 'SENDGRID' | 'MAILCHIMP';

export type EmailSendPayload = {
  to: string;
  subject: string;
  html: string;
  /** Override sender — falls back to provider-level default */
  fromName?: string;
  fromEmail?: string;
};

export type EmailSendResult = {
  messageId: string;
};

export interface EmailProvider {
  readonly name: EmailProviderName;
  sendMail(payload: EmailSendPayload): Promise<EmailSendResult>;
  isAvailable(): boolean;
}

export class EmailProviderNotConfiguredError extends Error {
  constructor() {
    super('Email provider not configured for this organization');
    this.name = 'EmailProviderNotConfiguredError';
  }
}

/** Provider explicitly refused acceptance; never carries response bodies. */
export class EmailProviderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailProviderRejectedError';
  }
}

/** HTTP timeouts/server failures can follow acceptance and remain ambiguous. */
export function emailHttpFailure(provider: 'Resend' | 'SendGrid' | 'Mailchimp Transactional', status: number): Error {
  // Keep the established prefix consumed by notification outbox retry logic.
  // Never append the provider response body: it may contain recipient data.
  const message = `${provider} API error ${status}: response body redacted`;
  // 429 is a provider rate-limit refusal, not a queued message. Mandrill's
  // accepted-but-delayed messages instead use a successful "queued" result.
  return status >= 400 && status < 500 && status !== 408
    ? new EmailProviderRejectedError(message)
    : new Error(message);
}
