// email-provider — read the tenant's email provider config (upsert-on-read singleton).
// Never returns decrypted credentials (credentialsCiphertext).

import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type OrgEmailConfigView = {
  id: string;
  organizationId: string;
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
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<OrgEmailConfigView> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const row = await this.prisma.organizationEmailConfig.upsert({
      where: { organizationId },
      update: {},
      create: { provider: 'NONE' },
    });
    return this.toView(row);
  }

  private toView(row: {
    id: string;
    organizationId: string;
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
