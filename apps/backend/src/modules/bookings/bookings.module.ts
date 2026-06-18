import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { FinanceModule } from '../finance/finance.module';
import { CreateBookingHandler } from './create-booking/create-booking.handler';
import { CancelBookingHandler } from './cancel-booking/cancel-booking.handler';
import { DeleteBookingHandler } from './delete-booking/delete-booking.handler';
import { RescheduleBookingHandler } from './reschedule-booking/reschedule-booking.handler';
import { ConfirmBookingHandler } from './confirm-booking/confirm-booking.handler';
import { GetBookingHandler } from './get-booking/get-booking.handler';
import { ListBookingsHandler } from './list-bookings/list-bookings.handler';
import { BookingsStatsHandler } from './bookings-stats/bookings-stats.handler';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { CheckInBookingHandler } from './check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from './complete-booking/complete-booking.handler';
import { NoShowBookingHandler } from './no-show-booking/no-show-booking.handler';
import { ExpireBookingHandler } from './expire-booking/expire-booking.handler';
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';
import { PaymentCompletedEventHandler } from './payment-completed-handler/payment-completed.handler';
import { DepositPaidEventHandler } from './deposit-paid-handler/deposit-paid.handler';
import { RefundCompletedEventHandler } from './refund-completed-handler/refund-completed.handler';
import { GetBookingSettingsHandler } from './get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from './upsert-booking-settings/upsert-booking-settings.handler';
import { RequestCancelBookingHandler } from './request-cancel-booking/request-cancel-booking.handler';
import { ApproveCancelBookingHandler } from './approve-cancel-booking/approve-cancel-booking.handler';
import { RejectCancelBookingHandler } from './reject-cancel-booking/reject-cancel-booking.handler';
import { CreateZoomMeetingHandler } from './create-zoom-meeting/create-zoom-meeting.handler';
import { ZoomMeetingQueueService } from './create-zoom-meeting/zoom-meeting-queue.service';
import { ZoomMeetingWorker } from './create-zoom-meeting/zoom-meeting-worker';
import { RetryZoomMeetingHandler } from './retry-zoom-meeting/retry-zoom-meeting.handler';
import { ZoomMeetingService } from './zoom-meeting.service';
import { ZoomModule } from '../integrations/zoom/zoom.module';
import { GroupSessionMinReachedHandler } from './group-session-min-reached/group-session-min-reached.handler';
import { DashboardBookingsController } from '../../api/dashboard/bookings.controller';
import { GetPublicAvailabilityHandler } from './availability/public/get-public-availability.handler';
import { GetPublicAvailabilityDaysHandler } from './availability/public/get-public-availability-days.handler';
import { ListClientBookingsHandler } from './client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from './client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from './client/client-reschedule-booking.handler';
import { GetClientBookingHandler } from './client/get-client-booking.handler';
import { ListPublicGroupSessionsHandler } from './public/list-public-group-sessions.handler';
import { GetPublicGroupSessionHandler } from './public/get-public-group-session.handler';
import { BookGroupSessionHandler } from './public/book-group-session.handler';
import { GetBookingStatusHandler } from './public/get-booking-status.handler';
import { CreatePublicBookingHandler } from './public/create-public-booking.handler';
import { CreateEmployeeBookingHandler } from './create-employee-booking/create-employee-booking.handler';
import { ValidateCouponService } from './coupons/validate-coupon.service';
import { CreateBundleBookingHandler } from './create-bundle-booking/create-bundle-booking.handler';
import { GroupSessionCapacityService } from './group-session/group-session-capacity.service';

const handlers = [
  CreateBookingHandler,
  CreateEmployeeBookingHandler,
  CancelBookingHandler,
  DeleteBookingHandler,
  RescheduleBookingHandler,
  ConfirmBookingHandler,
  GetBookingHandler,
  ListBookingsHandler,
  BookingsStatsHandler,
  CheckAvailabilityHandler,
  CheckInBookingHandler,
  CompleteBookingHandler,
  NoShowBookingHandler,
  ExpireBookingHandler,
  ListBookingStatusLogHandler,
  GetBookingSettingsHandler,
  UpsertBookingSettingsHandler,
  RequestCancelBookingHandler,
  ApproveCancelBookingHandler,
  RejectCancelBookingHandler,
  CreateZoomMeetingHandler,
  ZoomMeetingQueueService,
  RetryZoomMeetingHandler,
  ZoomMeetingService,
  GroupSessionMinReachedHandler,
  GetPublicAvailabilityHandler,
  GetPublicAvailabilityDaysHandler,
  ListClientBookingsHandler,
  ClientCancelBookingHandler,
  ClientRescheduleBookingHandler,
  GetClientBookingHandler,
  ListPublicGroupSessionsHandler,
  GetPublicGroupSessionHandler,
  BookGroupSessionHandler,
  GetBookingStatusHandler,
  CreatePublicBookingHandler,
  ValidateCouponService,
  CreateBundleBookingHandler,
  GroupSessionCapacityService,
];

@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    OrgExperienceModule,
    ZoomModule,
    FinanceModule,
  ],
  controllers: [DashboardBookingsController],
  providers: [...handlers, ZoomMeetingWorker, PaymentCompletedEventHandler, DepositPaidEventHandler, RefundCompletedEventHandler],
  exports: [...handlers, CheckAvailabilityHandler, ListClientBookingsHandler, ClientCancelBookingHandler, ClientRescheduleBookingHandler, ValidateCouponService, CreatePublicBookingHandler],
})
export class BookingsModule implements OnModuleInit {
  constructor(
    private readonly paymentCompletedHandler: PaymentCompletedEventHandler,
    private readonly depositPaidHandler: DepositPaidEventHandler,
    private readonly refundCompletedHandler: RefundCompletedEventHandler,
  ) {}

  onModuleInit(): void {
    this.paymentCompletedHandler.register();
    this.depositPaidHandler.register();
    this.refundCompletedHandler.register();
  }
}
