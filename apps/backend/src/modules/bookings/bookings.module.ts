import { ProgramCancelledResultHandler } from './cancel-program/program-cancelled-result.handler';
import { ClientCancellationOutcomeHandler } from './client/client-cancellation-outcome.handler';
import { ClientCancellationZoomHandler } from './client/client-cancellation-zoom.handler';
import { ClientCancellationPreviewHandler } from './client/client-cancellation-preview.handler';
import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { MessagingModule } from '../../infrastructure/messaging.module';
import { OrgExperienceModule } from '../org-experience/org-experience.module';
import { OrgConfigModule } from '../org-config/org-config.module';
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
import { RestoreNoShowBookingHandler } from './restore-no-show-booking/restore-no-show-booking.handler';
import { ExpireBookingHandler } from './expire-booking/expire-booking.handler';
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';
import { GetBookingTimelineHandler } from './get-booking-timeline/get-booking-timeline.handler';
import { PaymentCompletedEventHandler } from './payment-completed-handler/payment-completed.handler';
import { DepositPaidEventHandler } from './deposit-paid-handler/deposit-paid.handler';
import { RefundCompletedCompatibilityHandler } from './refund-completed-handler/refund-completed.handler';
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
import { DashboardBookingsController } from '../../api/dashboard/bookings.controller';
import { DashboardProgramsController } from '../../api/dashboard/programs.controller';
import { GetPublicAvailabilityHandler } from './availability/public/get-public-availability.handler';
import { GetPublicAvailabilityDaysHandler } from './availability/public/get-public-availability-days.handler';
import { ListClientBookingsHandler } from './client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from './client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from './client/client-reschedule-booking.handler';
import { GetClientBookingHandler } from './client/get-client-booking.handler';
import { GetBookingStatusHandler } from './public/get-booking-status.handler';
import { CreatePublicBookingHandler } from './public/create-public-booking.handler';
import { CreateEmployeeBookingHandler } from './create-employee-booking/create-employee-booking.handler';
import { ValidateCouponService } from './coupons/validate-coupon.service';
import { ProgramCapacityService } from './program/program-capacity.service';
import { EnrollInProgramHandler } from './enroll-in-program/enroll-in-program.handler';
import { ListProgramsHandler } from './list-programs/list-programs.handler';
import { GetProgramHandler } from './get-program/get-program.handler';
import { CreateProgramHandler } from './create-program/create-program.handler';
import { UpdateProgramHandler } from './update-program/update-program.handler';
import { PublishProgramHandler } from './publish-program/publish-program.handler';
import { ScheduleProgramHandler } from './schedule-program/schedule-program.handler';
import { CancelProgramHandler } from './cancel-program/cancel-program.handler';
import { ListPublicProgramsHandler } from './public/list-public-programs.handler';
import { GetPublicProgramHandler } from './public/get-public-program.handler';
import { BookFromCreditHandler } from './book-from-credit/book-from-credit.handler';
import { GetMatchingCreditsHandler } from './get-matching-credits/get-matching-credits.handler';
import { TransferCreditHandler } from './transfer-credit/transfer-credit.handler';
import { BookingZoomRescheduleHandler } from './zoom-reschedule/booking-zoom-reschedule.handler';
import { BookingZoomCreateRequestedHandler } from './create-zoom-meeting/booking-zoom-create-requested.handler';
import { AssertEmployeeBookingOwnershipHandler } from './assert-employee-booking-ownership/assert-employee-booking-ownership.handler';
import { GetClientPortalSummaryHandler } from './client/get-client-portal-summary.handler';
import { ListClientUpcomingBookingsHandler } from './client/list-client-upcoming-bookings.handler';
import { GetClientBookingForActionHandler } from './client/get-client-booking-for-action.handler';
import { GetEmployeeMeetingStartHandler } from './get-employee-meeting-start/get-employee-meeting-start.handler';
import { EmployeeAvailabilityQueryHandler } from './employee-availability-query.handler';

const handlers = [
  ClientCancellationPreviewHandler,
  ClientCancellationOutcomeHandler,
  ClientCancellationZoomHandler,
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
  RestoreNoShowBookingHandler,
  ExpireBookingHandler,
  ListBookingStatusLogHandler,
  GetBookingTimelineHandler,
  GetBookingSettingsHandler,
  UpsertBookingSettingsHandler,
  RequestCancelBookingHandler,
  ApproveCancelBookingHandler,
  RejectCancelBookingHandler,
  CreateZoomMeetingHandler,
  ZoomMeetingQueueService,
  RetryZoomMeetingHandler,
  ZoomMeetingService,
  GetPublicAvailabilityHandler,
  GetPublicAvailabilityDaysHandler,
  ListClientBookingsHandler,
  ClientCancelBookingHandler,
  ClientRescheduleBookingHandler,
  GetClientBookingHandler,
  GetBookingStatusHandler,
  CreatePublicBookingHandler,
  ValidateCouponService,
  ProgramCapacityService,
  EnrollInProgramHandler,
  ListProgramsHandler,
  GetProgramHandler,
  CreateProgramHandler,
  UpdateProgramHandler,
  PublishProgramHandler,
  ScheduleProgramHandler,
  CancelProgramHandler,
  ProgramCancelledResultHandler,
  ListPublicProgramsHandler,
  GetPublicProgramHandler,
  BookFromCreditHandler,
  GetMatchingCreditsHandler,
  TransferCreditHandler,
  BookingZoomRescheduleHandler,
  BookingZoomCreateRequestedHandler,
  AssertEmployeeBookingOwnershipHandler,
  GetClientPortalSummaryHandler,
  ListClientUpcomingBookingsHandler,
  GetClientBookingForActionHandler,
  GetEmployeeMeetingStartHandler,
  EmployeeAvailabilityQueryHandler,
];

@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    OrgExperienceModule,
    OrgConfigModule,
    ZoomModule,
    FinanceModule,
  ],
  controllers: [DashboardBookingsController, DashboardProgramsController],
  providers: [...handlers, ZoomMeetingWorker, PaymentCompletedEventHandler, DepositPaidEventHandler, RefundCompletedCompatibilityHandler],
  exports: [...handlers, CheckAvailabilityHandler, ListClientBookingsHandler, ClientCancelBookingHandler, ClientRescheduleBookingHandler, ValidateCouponService, CreatePublicBookingHandler, NoShowBookingHandler, RestoreNoShowBookingHandler, GetClientPortalSummaryHandler, ListClientUpcomingBookingsHandler, GetClientBookingForActionHandler, EmployeeAvailabilityQueryHandler],
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
