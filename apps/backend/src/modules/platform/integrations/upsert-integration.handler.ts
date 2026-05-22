import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { asPrismaJson } from '../../../common/prisma-json';
import { IntegrationCredentialsService } from '../../../infrastructure/integrations/integration-credentials.service';
import { UpsertIntegrationDto } from './upsert-integration.dto';

export type UpsertIntegrationCommand = UpsertIntegrationDto;

@Injectable()
export class UpsertIntegrationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creds: IntegrationCredentialsService,
  ) {}

  async execute(cmd: UpsertIntegrationCommand) {
    // SECURITY (P0-10): the config blob commonly contains apiKey / webhookSecret
    // / clientSecret. Encrypt at rest with AES-256-GCM (per-deployment HKDF
    // derivation). The stored shape is `{ ciphertext: string }` so existing
    // readers that bypass the credentials service still cannot misread plaintext.
    const ciphertext = this.creds.encrypt(cmd.config);
    const stored = { ciphertext };
    return this.prisma.integration.upsert({
      where: { provider: cmd.provider },
      create: {
        provider: cmd.provider,
        config: asPrismaJson(stored),
        isActive: cmd.isActive ?? true,
      },
      update: { config: asPrismaJson(stored), isActive: cmd.isActive ?? true },
    });
  }
}
