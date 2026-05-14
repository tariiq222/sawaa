import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { BookingsModule } from '../../../modules/bookings/bookings.module';
import { PeopleModule } from '../../../modules/people/people.module';
import { MobileEmployeeScheduleController } from './schedule.controller';
import { MobileEmployeeClientsController } from './clients.controller';
import { MobileEmployeeEarningsController } from './earnings.controller';
import { MobileEmployeeBookingsController } from './bookings.controller';

@Module({
  imports: [DatabaseModule, BookingsModule, PeopleModule],
  controllers: [
    MobileEmployeeScheduleController,
    MobileEmployeeClientsController,
    MobileEmployeeEarningsController,
    MobileEmployeeBookingsController,
  ],
})
export class MobileEmployeeModule {}
