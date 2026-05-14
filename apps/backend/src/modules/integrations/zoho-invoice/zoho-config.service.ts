import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ZohoCredentialsService, type ZohoIntegrationConfig } from '../../../infrastructure/zoho';

export const ZOHO_PROVIDER = 'zoho-invoice';

interface IntegrationConfigBlob {
  ciphertext?: string;
  // Half-finished Connect flow stores the in-progress data center under
  // `connectingDc` so the OAuth callback can resolve the tenant + DC.
  connectingDc?: string;
}

/**
 * Reads + writes the encrypted `Integration` row for `provider='zoho-invoice'`.
 *
 * The row is shared with all the other Integration rows (one per provider per
 * tenant). We treat it as the single source of truth for "is this tenant
 * connected to Zoho" — anything not represented here is considered unconnected.
 */
@Injectable()
export class ZohoConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creds: ZohoCredentialsService,
  ) {}

  async load(organizationId: string): Promise<{
    isConfigured: boolean;
    isActive: boolean;
    config?: ZohoIntegrationConfig;
  }> {
    const row = await this.prisma.integration.findUnique({
      where: { provider: ZOHO_PROVIDER },
    });
    if (!row) return { isConfigured: false, isActive: false };
    const blob = (row.config as IntegrationConfigBlob) ?? {};
    if (!blob.ciphertext) {
      return { isConfigured: false, isActive: row.isActive };
    }
    const config = this.creds.decrypt<Record<string, unknown>>(blob.ciphertext, organizationId) as unknown as ZohoIntegrationConfig;
    return { isConfigured: true, isActive: row.isActive, config };
  }

  async require(organizationId: string): Promise<ZohoIntegrationConfig> {
    const result = await this.load(organizationId);
    if (!result.isConfigured || !result.config) {
      throw new BadRequestException(
        'Zoho Invoice integration is not configured for this organization.',
      );
    }
    if (!result.isActive) {
      throw new BadRequestException(
        'Zoho Invoice integration is disabled. Reconnect to re-enable.',
      );
    }
    return result.config;
  }

  async save(
    organizationId: string,
    config: ZohoIntegrationConfig,
    opts: { isActive?: boolean } = {},
  ): Promise<void> {
    const ciphertext = this.creds.encrypt(
      config as unknown as Record<string, unknown>,
      organizationId,
    );
    await this.prisma.integration.upsert({
      where: { provider: ZOHO_PROVIDER },
      update: {
        config: { ciphertext },
        isActive: opts.isActive ?? true,
      },
      create: {
        provider: ZOHO_PROVIDER,
        config: { ciphertext },
        isActive: opts.isActive ?? true,
      },
    });
  }

  async setActive(organizationId: string, isActive: boolean): Promise<void> {
    await this.prisma.integration.updateMany({
      where: { provider: ZOHO_PROVIDER },
      data: { isActive },
    });
  }

  async remove(organizationId: string): Promise<void> {
    await this.prisma.integration.deleteMany({
      where: { provider: ZOHO_PROVIDER },
    });
  }
}
