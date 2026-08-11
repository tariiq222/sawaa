import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { FinanceModule } from '../../../modules/finance/finance.module';
import { CommsModule } from '../../../modules/comms/comms.module';
import { OrgExperienceModule } from '../../../modules/org-experience/org-experience.module';
import { IdentityModule } from '../../../modules/identity/identity.module';
import { MobileClientBookingsController } from './bookings.controller';
import { MobileClientProfileController } from './profile.controller';
import { MobileClientPaymentsController } from './payments.controller';
import { MobileClientNotificationsController } from './notifications.controller';
import { MobileClientHomeController } from './portal/home.controller';
import { MobileClientUpcomingController } from './portal/upcoming.controller';
import { MobileClientSummaryController } from './portal/summary.controller';
import { MobileClientAuthController } from './auth.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, PeopleModule, FinanceModule, CommsModule, OrgExperienceModule, IdentityModule],
  controllers: [
    MobileClientBookingsController,
    MobileClientProfileController,
    MobileClientPaymentsController,
    MobileClientNotificationsController,
    MobileClientHomeController,
    MobileClientUpcomingController,
    MobileClientSummaryController,
    MobileClientAuthController,
  ],
})
export class MobileClientModule {}
