import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { BookingsModule } from '../../modules/bookings/bookings.module';
import { OrgExperienceModule } from '../../modules/org-experience/org-experience.module';
import { DashboardOrganizationSettingsController } from './organization-settings.controller';

/**
 * Dashboard audience module for the organization-settings surface.
 *
 * `DashboardOrganizationSettingsController` lives in `src/api/dashboard/` but
 * was registered inside `OrgExperienceModule`, which forced that module to
 * import `BookingsModule` and re-export its booking-settings handlers purely to
 * satisfy this controller's constructor. Registering it in the API layer keeps
 * the cross-cluster wiring where it belongs and lets `org-experience` drop the
 * bookings import.
 *
 * No route, guard or DTO change: the controller keeps its `@Controller` prefix,
 * guards and permission checks; only the module that instantiates it changes.
 */
@Module({
  imports: [DatabaseModule, OrgExperienceModule, BookingsModule],
  controllers: [DashboardOrganizationSettingsController],
})
export class DashboardOrganizationSettingsModule {}
