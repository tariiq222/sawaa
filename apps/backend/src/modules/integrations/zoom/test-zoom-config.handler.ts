import { Injectable } from '@nestjs/common';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant/tenant.constants';

@Injectable()
export class TestZoomConfigHandler {
  constructor(
    private readonly zoomApi: ZoomApiClient,
  ) {}

  async execute(dto: UpsertZoomConfigDto) {
    try {
      await this.zoomApi.getAccessToken(
        DEFAULT_ORGANIZATION_ID,
        dto.zoomClientId,
        dto.zoomClientSecret,
        dto.zoomAccountId,
      );
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }
}
