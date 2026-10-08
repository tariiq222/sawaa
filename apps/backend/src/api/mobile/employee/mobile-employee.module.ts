import { IdentityModule } from '../../../modules/identity/identity.module';
import { MobileEmployeeProfileController } from './profile.controller';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { FinanceModule } from '../../../modules/finance/finance.module';
import { MobileEmployeeScheduleController } from './schedule.controller';
import { MobileEmployeeClientsController } from './clients.controller';
import { MobileEmployeeEarningsController } from './earnings.controller';
import { MobileEmployeeBookingsController } from './bookings.controller';

@Module({
  imports: [IdentityModule, DatabaseModule, BookingsModule, PeopleModule, FinanceModule],
  controllers: [
    MobileEmployeeProfileController,
    MobileEmployeeScheduleController,
    MobileEmployeeClientsController,
    MobileEmployeeEarningsController,
    MobileEmployeeBookingsController,
  ],
})
export class MobileEmployeeModule {}
