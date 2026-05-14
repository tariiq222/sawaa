// SaaS-02g-sms — read the tenant's SMS config (upsert-on-read singleton).
// Never returns decrypted secrets or the webhook secret.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type OrgSmsConfigView = {
  id: string;
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
  ) {}

  async execute(): Promise<OrgSmsConfigView> {
    const existing = await this.prisma.organizationSmsConfig.findFirst();
    const row = existing
      ? existing
      : await this.prisma.organizationSmsConfig.create({ data: { provider: 'NONE' } });
    return {
      id: row.id,
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
