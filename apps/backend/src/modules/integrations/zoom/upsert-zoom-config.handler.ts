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
    const encryptedConfig = this.zoomCredentials.encrypt(
      {
        zoomClientId: dto.zoomClientId,
        zoomClientSecret: dto.zoomClientSecret,
        zoomAccountId: dto.zoomAccountId,
      },
      DEFAULT_ORG_ID,
    );

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
