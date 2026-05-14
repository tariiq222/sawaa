// email-provider — upsert the tenant's email provider config.
// Encrypts credentials with AES-GCM (orgId AAD) before persisting.

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmailCredentialsService } from '../../../infrastructure/email/email-credentials.service';
import type { UpsertOrgEmailConfigDto } from './upsert-org-email-config.dto';
import type { OrgEmailConfigView } from './get-org-email-config.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type UpsertOrgEmailConfigCommand = UpsertOrgEmailConfigDto;

@Injectable()
export class UpsertOrgEmailConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: EmailCredentialsService,
  ) {}

  async execute(cmd: UpsertOrgEmailConfigCommand): Promise<OrgEmailConfigView> {
    // organizationId kept as AES-GCM AAD for credential encryption/decryption
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
          DEFAULT_ORG_ID,
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
          DEFAULT_ORG_ID,
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
          DEFAULT_ORG_ID,
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
          DEFAULT_ORG_ID,
        );
        break;
    }

    const existing = await this.prisma.organizationEmailConfig.findFirst();
    let row;
    if (existing) {
      row = await this.prisma.organizationEmailConfig.update({
        where: { id: existing.id },
        data: {
          provider: cmd.provider,
          senderName: cmd.senderName ?? null,
          senderEmail: cmd.senderEmail ?? null,
          credentialsCiphertext: credentialsCiphertext ?? null,
        },
      });
    } else {
      row = await this.prisma.organizationEmailConfig.create({
        data: {
          provider: cmd.provider,
          senderName: cmd.senderName ?? null,
          senderEmail: cmd.senderEmail ?? null,
          credentialsCiphertext: credentialsCiphertext ?? null,
        },
      });
    }

    return {
      id: row.id,
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
