// email-provider — shared email provider contract (mirrors sms-provider.interface.ts pattern).

export type EmailProviderName = 'NONE' | 'SMTP' | 'RESEND' | 'SENDGRID' | 'MAILCHIMP';

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
