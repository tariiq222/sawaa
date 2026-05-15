import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

@Injectable()
export class UpsertZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomCredentials: ZoomCredentialsService,
    private readonly zoomApi: ZoomApiClient,
  ) {}

  async execute(dto: UpsertZoomConfigDto) {
    const existing = await this.prisma.integration.findUnique({
      where: { provider: 'zoom' },
    });

    let config: { zoomClientId: string; zoomClientSecret: string; zoomAccountId: string };

    if (existing && existing.config && typeof existing.config === 'object' && 'ciphertext' in existing.config) {
      // Decrypt existing config to merge with partial update
      const existingConfig = this.zoomCredentials.decrypt<{
        zoomClientId?: string;
        zoomClientSecret?: string;
        zoomAccountId?: string;
      }>(existing.config.ciphertext as string, DEFAULT_ORG_ID);

      config = {
        zoomClientId: dto.zoomClientId ?? existingConfig.zoomClientId ?? '',
        zoomClientSecret: dto.zoomClientSecret ?? existingConfig.zoomClientSecret ?? '',
        zoomAccountId: dto.zoomAccountId ?? existingConfig.zoomAccountId ?? '',
      };
    } else {
      config = {
        zoomClientId: dto.zoomClientId ?? '',
        zoomClientSecret: dto.zoomClientSecret ?? '',
        zoomAccountId: dto.zoomAccountId ?? '',
      };
    }

    if (!config.zoomClientId || !config.zoomClientSecret || !config.zoomAccountId) {
      throw new Error('zoomClientId, zoomClientSecret, and zoomAccountId are required');
    }

    const encryptedConfig = this.zoomCredentials.encrypt(config, DEFAULT_ORG_ID);

    await this.prisma.integration.upsert({
      where: { provider: 'zoom' },
      update: {
        config: { ciphertext: encryptedConfig },
        isActive: true,
      },
      create: {
        provider: 'zoom',
        config: { ciphertext: encryptedConfig },
        isActive: true,
      },
    });

    // Invalidate cached OAuth token so the new credentials take effect immediately
    // instead of waiting up to ~1h for the previous token to expire.
    this.zoomApi.invalidateToken(DEFAULT_ORG_ID);

    return { configured: true, isActive: true };
  }
}
