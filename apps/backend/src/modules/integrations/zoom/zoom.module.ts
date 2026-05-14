import { Module } from '@nestjs/common';
import { GetZoomConfigHandler } from './get-zoom-config.handler';
import { UpsertZoomConfigHandler } from './upsert-zoom-config.handler';
import { TestZoomConfigHandler } from './test-zoom-config.handler';
import { DashboardIntegrationsController } from '../../../api/dashboard/integrations.controller';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { DatabaseModule } from '../../../infrastructure/database';
import { TenantModule } from '../../../common/tenant';

@Module({
  imports: [DatabaseModule, TenantModule],
  controllers: [DashboardIntegrationsController],
  providers: [
    GetZoomConfigHandler,
    UpsertZoomConfigHandler,
    TestZoomConfigHandler,
    ZoomApiClient,
    ZoomCredentialsService,
  ],
  exports: [
    GetZoomConfigHandler,
    UpsertZoomConfigHandler,
    TestZoomConfigHandler,
    ZoomApiClient,
    ZoomCredentialsService,
  ],
})
export class ZoomModule {}
