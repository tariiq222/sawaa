/**
 * The booking handler roster, kept out of `bookings.module.ts` so the module
 * file stays inside the 120-line budget (MNT-20). Registration order is
 * unchanged: this array is spread into `providers` exactly as before.
 */
import { ApproveCancelBookingHandler } from './approve-cancel-booking/approve-cancel-booking.handler';
import { AssertEmployeeBookingOwnershipHandler } from './assert-employee-booking-ownership/assert-employee-booking-ownership.handler';
import { GetPublicAvailabilityDaysHandler } from './availability/public/get-public-availability-days.handler';
import { GetPublicAvailabilityHandler } from './availability/public/get-public-availability.handler';
import { BookFromCreditHandler } from './book-from-credit/book-from-credit.handler';
import { BookingsStatsHandler } from './bookings-stats/bookings-stats.handler';
import { CancelBookingHandler } from './cancel-booking/cancel-booking.handler';
import { CancelProgramHandler } from './cancel-program/cancel-program.handler';
import { ProgramCancelledResultHandler } from './cancel-program/program-cancelled-result.handler';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { CheckInBookingHandler } from './check-in-booking/check-in-booking.handler';
import { ClientCancelBookingHandler } from './client/client-cancel-booking.handler';
import { ClientCancellationOutcomeHandler } from './client/client-cancellation-outcome.handler';
import { ClientCancellationPreviewHandler } from './client/client-cancellation-preview.handler';
import { ClientCancellationZoomHandler } from './client/client-cancellation-zoom.handler';
import { ClientRescheduleBookingHandler } from './client/client-reschedule-booking.handler';
import { GetClientBookingForActionHandler } from './client/get-client-booking-for-action.handler';
import { GetClientBookingHandler } from './client/get-client-booking.handler';
import { GetClientPortalSummaryHandler } from './client/get-client-portal-summary.handler';
import { ListClientBookingsHandler } from './client/list-client-bookings.handler';
import { ListClientUpcomingBookingsHandler } from './client/list-client-upcoming-bookings.handler';
import { CompleteBookingHandler } from './complete-booking/complete-booking.handler';
import { ConfirmBookingHandler } from './confirm-booking/confirm-booking.handler';
import { ValidateCouponService } from './coupons/validate-coupon.service';
import { CreateBookingHandler } from './create-booking/create-booking.handler';
import { CreateEmployeeBookingHandler } from './create-employee-booking/create-employee-booking.handler';
import { CreateProgramHandler } from './create-program/create-program.handler';
import { BookingZoomCreateRequestedHandler } from './create-zoom-meeting/booking-zoom-create-requested.handler';
import { CreateZoomMeetingHandler } from './create-zoom-meeting/create-zoom-meeting.handler';
import { ZoomMeetingQueueService } from './create-zoom-meeting/zoom-meeting-queue.service';
import { DeleteBookingHandler } from './delete-booking/delete-booking.handler';
import { EmployeeAvailabilityQueryHandler } from './employee-availability-query.handler';
import { EnrollInProgramHandler } from './enroll-in-program/enroll-in-program.handler';
import { ExpireBookingHandler } from './expire-booking/expire-booking.handler';
import { GetBookingSettingsHandler } from './get-booking-settings/get-booking-settings.handler';
import { GetBookingTimelineHandler } from './get-booking-timeline/get-booking-timeline.handler';
import { GetBookingHandler } from './get-booking/get-booking.handler';
import { GetEmployeeMeetingStartHandler } from './get-employee-meeting-start/get-employee-meeting-start.handler';
import { GetLateSessionContextHandler } from './get-late-session-context/get-late-session-context.handler';
import { GetMatchingCreditsHandler } from './get-matching-credits/get-matching-credits.handler';
import { GetProgramHandler } from './get-program/get-program.handler';
import { ListBookingStatusLogHandler } from './list-booking-status-log/list-booking-status-log.handler';
import { ListBookingsHandler } from './list-bookings/list-bookings.handler';
import { ListProgramsHandler } from './list-programs/list-programs.handler';
import { NoShowBookingHandler } from './no-show-booking/no-show-booking.handler';
import { ProgramCapacityService } from './program/program-capacity.service';
import { CreatePublicBookingHandler } from './public/create-public-booking.handler';
import { GetBookingStatusHandler } from './public/get-booking-status.handler';
import { GetPublicProgramHandler } from './public/get-public-program.handler';
import { ListPublicProgramsHandler } from './public/list-public-programs.handler';
import { PublishProgramHandler } from './publish-program/publish-program.handler';
import { RecordLateSessionHandler } from './record-late-session/record-late-session.handler';
import { RejectCancelBookingHandler } from './reject-cancel-booking/reject-cancel-booking.handler';
import { RequestCancelBookingHandler } from './request-cancel-booking/request-cancel-booking.handler';
import { RescheduleBookingHandler } from './reschedule-booking/reschedule-booking.handler';
import { RestoreNoShowBookingHandler } from './restore-no-show-booking/restore-no-show-booking.handler';
import { RetryZoomMeetingHandler } from './retry-zoom-meeting/retry-zoom-meeting.handler';
import { ScheduleProgramHandler } from './schedule-program/schedule-program.handler';
import { TransferCreditHandler } from './transfer-credit/transfer-credit.handler';
import { UpdateProgramHandler } from './update-program/update-program.handler';
import { UpsertBookingSettingsHandler } from './upsert-booking-settings/upsert-booking-settings.handler';
import { ZoomMeetingService } from './zoom-meeting.service';
import { BookingZoomRescheduleHandler } from './zoom-reschedule/booking-zoom-reschedule.handler';

export const bookingHandlers = [
  GetLateSessionContextHandler,
  RecordLateSessionHandler,
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
