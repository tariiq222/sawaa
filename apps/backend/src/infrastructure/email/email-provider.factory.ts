// email-provider-factory — resolves the EmailProvider adapter for the current tenant.
// Falls back to NoOpEmailAdapter when no provider is configured.
// Mirrors SmsProviderFactory pattern exactly.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailCredentialsService } from './email-credentials.service';
import { NoOpEmailAdapter } from './no-op.adapter';
import { SmtpEmailAdapter, type SmtpCredentials } from './smtp.adapter';
import { ResendEmailAdapter, type ResendCredentials } from './resend.adapter';
import { SendGridEmailAdapter, type SendGridCredentials } from './sendgrid.adapter';
import { MailchimpEmailAdapter, type MailchimpCredentials } from './mailchimp.adapter';
import type { EmailProvider } from './email-provider.interface';

@Injectable()
export class EmailProviderFactory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: EmailCredentialsService,
  ) {}

  async forCurrentTenant(organizationId: string): Promise<EmailProvider> {
    const cfg = await this.prisma.organizationEmailConfig.findFirst({
      where: { organizationId },
    });

    if (!cfg || cfg.provider === 'NONE' || !cfg.credentialsCiphertext) {
      return new NoOpEmailAdapter();
    }

    const senderName = cfg.senderName ?? undefined;
    const senderEmail = cfg.senderEmail ?? undefined;

    switch (cfg.provider) {
      case 'SMTP': {
        const creds = this.credentials.decrypt<SmtpCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        const adapter = new SmtpEmailAdapter(creds);
        return this.withSenderDefaults(adapter, senderName, senderEmail);
      }
      case 'RESEND': {
        const creds = this.credentials.decrypt<ResendCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        const adapter = new ResendEmailAdapter(creds);
        return this.withSenderDefaults(adapter, senderName, senderEmail);
      }
      case 'SENDGRID': {
        const creds = this.credentials.decrypt<SendGridCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        const adapter = new SendGridEmailAdapter(creds);
        return this.withSenderDefaults(adapter, senderName, senderEmail);
      }
      case 'MAILCHIMP': {
        const creds = this.credentials.decrypt<MailchimpCredentials>(
          cfg.credentialsCiphertext,
          organizationId,
        );
        const adapter = new MailchimpEmailAdapter(creds);
        return this.withSenderDefaults(adapter, senderName, senderEmail);
      }
      default:
        return new NoOpEmailAdapter();
    }
  }

  /**
   * Wrap an adapter to inject tenant-level sender defaults when the caller
   * does not provide fromName/fromEmail in the payload.
   */
  private withSenderDefaults(
    adapter: EmailProvider,
    senderName: string | undefined,
    senderEmail: string | undefined,
  ): EmailProvider {
    if (!senderName && !senderEmail) return adapter;

    // Proxy — forwards all calls but enriches payload with tenant sender defaults
    return {
      name: adapter.name,
      isAvailable: () => adapter.isAvailable(),
      sendMail: (payload) =>
        adapter.sendMail({
          fromName: payload.fromName ?? senderName,
          fromEmail: payload.fromEmail ?? senderEmail,
          ...payload,
        }),
    };
  }
}
