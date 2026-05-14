// email-provider — upsert the tenant's email provider config.
// Encrypts credentials with AES-GCM (orgId AAD) before persisting.

import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { EmailCredentialsService } from '../../../infrastructure/email/email-credentials.service';
import type { UpsertOrgEmailConfigDto } from './upsert-org-email-config.dto';
import type { OrgEmailConfigView } from './get-org-email-config.handler';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpsertOrgEmailConfigCommand = UpsertOrgEmailConfigDto;

@Injectable()
export class UpsertOrgEmailConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly credentials: EmailCredentialsService,
  ) {}

  async execute(cmd: UpsertOrgEmailConfigCommand): Promise<OrgEmailConfigView> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    let credentialsCiphertext: string | null;

    switch (cmd.provider) {
      case 'NONE':
        credentialsCiphertext = null;
        break;
      case 'SMTP':
        if (!cmd.smtp) {
          throw new BadRequestException({
            ar: 'بيانات اعتماد SMTP مطلوبة',
            en: 'SMTP credentials are required',
          });
        }
        credentialsCiphertext = this.credentials.encrypt(
          { host: cmd.smtp.host, port: cmd.smtp.port, user: cmd.smtp.user, pass: cmd.smtp.pass, secure: cmd.smtp.secure },
          organizationId,
        );
        break;
      case 'RESEND':
        if (!cmd.resend) {
          throw new BadRequestException({
            ar: 'مفتاح Resend API مطلوب',
            en: 'Resend API key is required',
          });
        }
        credentialsCiphertext = this.credentials.encrypt(
          { apiKey: cmd.resend.apiKey },
          organizationId,
        );
        break;
      case 'SENDGRID':
        if (!cmd.sendgrid) {
          throw new BadRequestException({
            ar: 'مفتاح SendGrid API مطلوب',
            en: 'SendGrid API key is required',
          });
        }
        credentialsCiphertext = this.credentials.encrypt(
          { apiKey: cmd.sendgrid.apiKey },
          organizationId,
        );
        break;
      case 'MAILCHIMP':
        if (!cmd.mailchimp) {
          throw new BadRequestException({
            ar: 'مفتاح Mailchimp API مطلوب',
            en: 'Mailchimp API key is required',
          });
        }
        credentialsCiphertext = this.credentials.encrypt(
          { apiKey: cmd.mailchimp.apiKey },
          organizationId,
        );
        break;
    }

    const row = await this.prisma.organizationEmailConfig.upsert({
      where: { organizationId },
      create: {
        provider: cmd.provider,
        senderName: cmd.senderName ?? null,
        senderEmail: cmd.senderEmail ?? null,
        credentialsCiphertext: credentialsCiphertext ?? null,
      },
      update: {
        provider: cmd.provider,
        senderName: cmd.senderName ?? null,
        senderEmail: cmd.senderEmail ?? null,
        credentialsCiphertext: credentialsCiphertext ?? null,
      },
    });

    return {
      id: row.id,
      organizationId: row.organizationId,
      provider: row.provider as OrgEmailConfigView['provider'],
      senderName: row.senderName,
      senderEmail: row.senderEmail,
      credentialsConfigured: !!row.credentialsCiphertext,
      lastTestAt: row.lastTestAt,
      lastTestOk: row.lastTestOk,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
