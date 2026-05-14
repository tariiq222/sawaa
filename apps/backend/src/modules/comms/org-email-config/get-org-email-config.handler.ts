// email-provider — read the tenant's email provider config (upsert-on-read singleton).
// Never returns decrypted credentials (credentialsCiphertext).

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type OrgEmailConfigView = {
  id: string;
  provider: 'NONE' | 'SMTP' | 'RESEND' | 'SENDGRID' | 'MAILCHIMP';
  senderName: string | null;
  senderEmail: string | null;
  credentialsConfigured: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GetOrgEmailConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<OrgEmailConfigView> {
    const existing = await this.prisma.organizationEmailConfig.findFirst();
    const row = existing
      ? existing
      : await this.prisma.organizationEmailConfig.create({ data: { provider: 'NONE' } });
    return this.toView(row);
  }

  private toView(row: {
    id: string;
    provider: string;
    senderName: string | null;
    senderEmail: string | null;
    credentialsCiphertext: string | null;
    lastTestAt: Date | null;
    lastTestOk: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  }): OrgEmailConfigView {
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
