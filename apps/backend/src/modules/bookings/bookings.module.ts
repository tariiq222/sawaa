import { ClientCancellationZoomHandler } from './client/client-cancellation-zoom.handler';
import { Module, OnModuleInit } from '@nestjs/common';
import { bookingHandlers } from './bookings.handlers';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { OrgConfigModule } from '../org-config/org-config.module';
import { FinanceModule } from '../finance/finance.module';
import { PackageLedgerModule } from './package-ledger/package-ledger.module';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { NoShowBookingHandler } from './no-show-booking/no-show-booking.handler';
import { RestoreNoShowBookingHandler } from './restore-no-show-booking/restore-no-show-booking.handler';
import { PaymentCompletedEventHandler } from './payment-completed-handler/payment-completed.handler';
import { DepositPaidEventHandler } from './deposit-paid-handler/deposit-paid.handler';
import { RefundCompletedCompatibilityHandler } from './refund-completed-handler/refund-completed.handler';
import { ZoomMeetingWorker } from './create-zoom-meeting/zoom-meeting-worker';
import { ZoomModule } from '../integrations/zoom/zoom.module';
import { DashboardBookingsLateEntryController } from '../../api/dashboard/bookings-late-entry.controller';
import { DashboardBookingsCreditsController } from '../../api/dashboard/bookings-credits.controller';
import { DashboardBookingsHistoryController } from '../../api/dashboard/bookings-history.controller';
import { DashboardBookingsLifecycleController } from '../../api/dashboard/bookings-lifecycle.controller';
import { DashboardBookingsController } from '../../api/dashboard/bookings.controller';
import { DashboardProgramsController } from '../../api/dashboard/programs.controller';
import { ListClientBookingsHandler } from './client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from './client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from './client/client-reschedule-booking.handler';
import { CreatePublicBookingHandler } from './public/create-public-booking.handler';
import { ValidateCouponService } from './coupons/validate-coupon.service';
import { BookingZoomRescheduleHandler } from './zoom-reschedule/booking-zoom-reschedule.handler';
import { BookingZoomCreateRequestedHandler } from './create-zoom-meeting/booking-zoom-create-requested.handler';
import { GetClientPortalSummaryHandler } from './client/get-client-portal-summary.handler';
import { ListClientUpcomingBookingsHandler } from './client/list-client-upcoming-bookings.handler';
import { GetClientBookingForActionHandler } from './client/get-client-booking-for-action.handler';
import { EmployeeAvailabilityQueryHandler } from './employee-availability-query.handler';

@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    OrgExperienceModule,
    OrgConfigModule,
    ZoomModule,
    FinanceModule,
    PackageLedgerModule,
  ],
  controllers: [
    DashboardBookingsLateEntryController,
    DashboardBookingsCreditsController,
    DashboardBookingsHistoryController,
    DashboardBookingsLifecycleController,
    DashboardBookingsController,
    DashboardProgramsController,
  ],
  providers: [...bookingHandlers, ZoomMeetingWorker, PaymentCompletedEventHandler, DepositPaidEventHandler, RefundCompletedCompatibilityHandler],
  exports: [...bookingHandlers, CheckAvailabilityHandler, ListClientBookingsHandler, ClientCancelBookingHandler, ClientRescheduleBookingHandler, ValidateCouponService, CreatePublicBookingHandler, NoShowBookingHandler, RestoreNoShowBookingHandler, GetClientPortalSummaryHandler, ListClientUpcomingBookingsHandler, GetClientBookingForActionHandler, EmployeeAvailabilityQueryHandler],
})
export class BookingsModule implements OnModuleInit {
  constructor(
    private readonly clientCancellationZoomHandler: ClientCancellationZoomHandler,
    private readonly paymentCompletedHandler: PaymentCompletedEventHandler,
    private readonly depositPaidHandler: DepositPaidEventHandler,
    private readonly refundCompletedCompatibilityHandler: RefundCompletedCompatibilityHandler,
    private readonly bookingZoomRescheduleHandler: BookingZoomRescheduleHandler,
    private readonly bookingZoomCreateRequestedHandler: BookingZoomCreateRequestedHandler,
  ) {}

  onModuleInit(): void {
    this.clientCancellationZoomHandler.register();
    this.paymentCompletedHandler.register();
    this.depositPaidHandler.register();
    this.refundCompletedCompatibilityHandler.register();
    this.bookingZoomRescheduleHandler.register();
    this.bookingZoomCreateRequestedHandler.register();
  }
}
