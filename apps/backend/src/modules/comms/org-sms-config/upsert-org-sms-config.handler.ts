// SaaS-02g-sms — upsert the tenant's SMS provider config.
// Encrypts credentials with AES-GCM (orgId AAD) before persisting.
// Rotates webhookSecret whenever provider changes.

import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TenantContextService } from '../../../common/tenant';
import { PrismaService } from '../../../infrastructure/database';
import { SmsCredentialsService } from '../../../infrastructure/sms/sms-credentials.service';
import type { UpsertOrgSmsConfigDto } from './upsert-org-sms-config.dto';
import type { OrgSmsConfigView } from './get-org-sms-config.handler';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type UpsertOrgSmsConfigCommand = UpsertOrgSmsConfigDto;

@Injectable()
export class UpsertOrgSmsConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly credentials: SmsCredentialsService,
  ) {}

  async execute(cmd: UpsertOrgSmsConfigCommand): Promise<OrgSmsConfigView> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const existing = await this.prisma.organizationSmsConfig.findFirst({
      where: { organizationId },
    });

    let credentialsCiphertext: string | null | undefined;
    if (cmd.provider === 'NONE') {
      credentialsCiphertext = null;
    } else if (cmd.provider === 'UNIFONIC') {
      if (!cmd.unifonic) {
        throw new BadRequestException({
          ar: 'بيانات اعتماد Unifonic مطلوبة',
          en: 'Unifonic credentials are required',
        });
      }
      credentialsCiphertext = this.credentials.encrypt(
        { appSid: cmd.unifonic.appSid, apiKey: cmd.unifonic.apiKey },
        organizationId,
      );
    } else if (cmd.provider === 'TAQNYAT') {
      if (!cmd.taqnyat) {
        throw new BadRequestException({
          ar: 'بيانات اعتماد Taqnyat مطلوبة',
          en: 'Taqnyat credentials are required',
        });
      }
      credentialsCiphertext = this.credentials.encrypt(
        { apiToken: cmd.taqnyat.apiToken },
        organizationId,
      );
    }

    // Rotate webhookSecret whenever provider changes.
    const providerChanged = !existing || existing.provider !== cmd.provider;
    const webhookSecret = providerChanged
      ? cmd.provider === 'NONE'
        ? null
        : randomBytes(32).toString('hex')
      : existing?.webhookSecret ?? null;

    const row = await this.prisma.organizationSmsConfig.upsert({
      where: { organizationId },
      create: {
        provider: cmd.provider,
        senderId: cmd.senderId ?? null,
        credentialsCiphertext: credentialsCiphertext ?? null,
        webhookSecret,
      },
      update: {
        provider: cmd.provider,
        senderId: cmd.senderId ?? null,
        credentialsCiphertext: credentialsCiphertext ?? null,
        webhookSecret,
      },
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
