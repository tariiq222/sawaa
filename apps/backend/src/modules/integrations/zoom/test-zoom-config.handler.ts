import { Injectable } from '@nestjs/common';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

@Injectable()
export class TestZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomCredentials: ZoomCredentialsService,
    private readonly zoomApi: ZoomApiClient,
  ) {}

  async execute(dto: UpsertZoomConfigDto) {
    let clientId = dto.zoomClientId;
    let clientSecret = dto.zoomClientSecret;
    let accountId = dto.zoomAccountId;

    // If any field is missing, read from the existing stored config
    if (!clientId || !clientSecret || !accountId) {
      const existing = await this.prisma.integration.findUnique({
        where: { provider: 'zoom' },
      });
      if (existing && existing.config && typeof existing.config === 'object' && 'ciphertext' in existing.config) {
        const stored = this.zoomCredentials.decrypt<{
          zoomClientId?: string;
          zoomClientSecret?: string;
          zoomAccountId?: string;
        }>(existing.config.ciphertext as string, DEFAULT_ORG_ID);
        clientId = clientId ?? stored.zoomClientId ?? '';
        clientSecret = clientSecret ?? stored.zoomClientSecret ?? '';
        accountId = accountId ?? stored.zoomAccountId ?? '';
      }
    }

    if (!clientId || !clientSecret || !accountId) {
      return { ok: false, error: 'Missing Zoom credentials' };
    }

    try {
      await this.zoomApi.getAccessToken(
        DEFAULT_ORG_ID,
        clientId,
        clientSecret,
        accountId,
      );
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }
}
