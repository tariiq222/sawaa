// SaaS-02g-sms — read the tenant's SMS config (upsert-on-read singleton).
// Never returns decrypted secrets or the webhook secret.

import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type OrgSmsConfigView = {
  id: string;
  organizationId: string;
  provider: 'NONE' | 'UNIFONIC' | 'TAQNYAT';
  senderId: string | null;
  credentialsConfigured: boolean;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GetOrgSmsConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(): Promise<OrgSmsConfigView> {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const row = await this.prisma.organizationSmsConfig.upsert({
      where: { organizationId },
      update: {},
      create: { provider: 'NONE' },
    });
    return {
      id: row.id,
      organizationId: row.organizationId,
      provider: row.provider,
      senderId: row.senderId,
      credentialsConfigured: !!row.credentialsCiphertext,
      lastTestAt: row.lastTestAt,
      lastTestOk: row.lastTestOk,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
