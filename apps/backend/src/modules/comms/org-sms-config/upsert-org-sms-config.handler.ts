// Upsert the SMS provider config.
// Encrypts credentials with AES-GCM before persisting.
// Rotates webhookSecret whenever provider changes.

import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../infrastructure/database';
import { SmsCredentialsService } from '../../../infrastructure/sms/sms-credentials.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import type { UpsertOrgSmsConfigDto } from './upsert-org-sms-config.dto';
import type { OrgSmsConfigView } from './get-org-sms-config.handler';

export type UpsertOrgSmsConfigCommand = UpsertOrgSmsConfigDto;

@Injectable()
export class UpsertOrgSmsConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: SmsCredentialsService,
  ) {}

  async execute(cmd: UpsertOrgSmsConfigCommand): Promise<OrgSmsConfigView> {
    const existing = await this.prisma.organizationSmsConfig.findFirst();

    const providerChanged = !existing || existing.provider !== cmd.provider;
    let credentialsCiphertext: string | null = providerChanged ? null : existing?.credentialsCiphertext ?? null;
    const invalidCredentials = (name: string) => new BadRequestException({
      message: `${name} credentials are required`,
      code: 'SMS_CREDENTIALS_REQUIRED',
      localized: { ar: `بيانات اعتماد ${name} كاملة وغير فارغة مطلوبة`, en: `${name} credentials are required` },
    });
    if (cmd.provider === 'NONE') {
      credentialsCiphertext = null;
    } else if (cmd.provider === 'UNIFONIC') {
      if (cmd.unifonic) {
        if (!cmd.unifonic.appSid?.trim() || !cmd.unifonic.apiKey?.trim()) throw invalidCredentials('Unifonic');
        credentialsCiphertext = this.credentials.encrypt(
          { appSid: cmd.unifonic.appSid.trim(), apiKey: cmd.unifonic.apiKey.trim() }, DEFAULT_ORG_ID,
        );
      } else if (!credentialsCiphertext) throw invalidCredentials('Unifonic');
    } else if (cmd.provider === 'TAQNYAT') {
      if (cmd.taqnyat) {
        if (!cmd.taqnyat.apiToken?.trim()) throw invalidCredentials('Taqnyat');
        credentialsCiphertext = this.credentials.encrypt({ apiToken: cmd.taqnyat.apiToken.trim() }, DEFAULT_ORG_ID);
      } else if (!credentialsCiphertext) throw invalidCredentials('Taqnyat');
    }

    // Rotate webhookSecret whenever provider changes.
    const webhookSecret = providerChanged
      ? cmd.provider === 'NONE'
        ? null
        : randomBytes(32).toString('hex')
      : existing?.webhookSecret ?? null;

    let row;
    if (existing) {
      row = await this.prisma.organizationSmsConfig.update({
        where: { id: existing.id },
        data: {
          provider: cmd.provider,
          senderId: cmd.senderId === undefined ? existing?.senderId ?? null : cmd.senderId,
          credentialsCiphertext: credentialsCiphertext ?? null,
          webhookSecret,
        },
      });
    } else {
      row = await this.prisma.organizationSmsConfig.create({
        data: {
          provider: cmd.provider,
          senderId: cmd.senderId ?? null,
          credentialsCiphertext: credentialsCiphertext ?? null,
          webhookSecret,
        },
      });
    }

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
