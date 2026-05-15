// Upsert the email provider config.
// Encrypts credentials with AES-GCM before persisting.

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EmailCredentialsService } from '../../../infrastructure/email/email-credentials.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import type { UpsertOrgEmailConfigDto } from './upsert-org-email-config.dto';
import type { OrgEmailConfigView } from './get-org-email-config.handler';

export type UpsertOrgEmailConfigCommand = UpsertOrgEmailConfigDto;

@Injectable()
export class UpsertOrgEmailConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: EmailCredentialsService,
  ) {}

  async execute(cmd: UpsertOrgEmailConfigCommand): Promise<OrgEmailConfigView> {
    let credentialsCiphertext: string | null | undefined;

    const existing = await this.prisma.organizationEmailConfig.findFirst();

    switch (cmd.provider) {
      case 'NONE':
        credentialsCiphertext = null;
        break;
      case 'SMTP':
        if (cmd.smtp) {
          credentialsCiphertext = this.credentials.encrypt(
            { host: cmd.smtp.host, port: cmd.smtp.port, user: cmd.smtp.user, pass: cmd.smtp.pass, secure: cmd.smtp.secure },
            DEFAULT_ORG_ID,
          );
        } else if (existing?.provider === 'SMTP') {
          credentialsCiphertext = undefined; // keep existing
        } else {
          throw new BadRequestException({
            ar: 'بيانات اعتماد SMTP مطلوبة',
            en: 'SMTP credentials are required',
          });
        }
        break;
      case 'RESEND':
        if (cmd.resend) {
          credentialsCiphertext = this.credentials.encrypt(
            { apiKey: cmd.resend.apiKey },
            DEFAULT_ORG_ID,
          );
        } else if (existing?.provider === 'RESEND') {
          credentialsCiphertext = undefined; // keep existing
        } else {
          throw new BadRequestException({
            ar: 'مفتاح Resend API مطلوب',
            en: 'Resend API key is required',
          });
        }
        break;
      case 'SENDGRID':
        if (cmd.sendgrid) {
          credentialsCiphertext = this.credentials.encrypt(
            { apiKey: cmd.sendgrid.apiKey },
            DEFAULT_ORG_ID,
          );
        } else if (existing?.provider === 'SENDGRID') {
          credentialsCiphertext = undefined; // keep existing
        } else {
          throw new BadRequestException({
            ar: 'مفتاح SendGrid API مطلوب',
            en: 'SendGrid API key is required',
          });
        }
        break;
      case 'MAILCHIMP':
        if (cmd.mailchimp) {
          credentialsCiphertext = this.credentials.encrypt(
            { apiKey: cmd.mailchimp.apiKey },
            DEFAULT_ORG_ID,
          );
        } else if (existing?.provider === 'MAILCHIMP') {
          credentialsCiphertext = undefined; // keep existing
        } else {
          throw new BadRequestException({
            ar: 'مفتاح Mailchimp API مطلوب',
            en: 'Mailchimp API key is required',
          });
        }
        break;
    }

    let row;
    if (existing) {
      row = await this.prisma.organizationEmailConfig.update({
        where: { id: existing.id },
        data: {
          provider: cmd.provider,
          senderName: cmd.senderName ?? null,
          senderEmail: cmd.senderEmail ?? null,
          ...(credentialsCiphertext !== undefined && {
            credentialsCiphertext: credentialsCiphertext ?? null,
          }),
        },
      });
    } else {
      if (credentialsCiphertext === undefined || credentialsCiphertext === null) {
        throw new BadRequestException({
          ar: 'بيانات الاعتماد مطلوبة عند الإنشاء',
          en: 'Credentials are required when creating a new config',
        });
      }
      row = await this.prisma.organizationEmailConfig.create({
        data: {
          provider: cmd.provider,
          senderName: cmd.senderName ?? null,
          senderEmail: cmd.senderEmail ?? null,
          credentialsCiphertext,
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
