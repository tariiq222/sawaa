/**
 * Response types for the authenticated `/client` surface routes that
 * `packages/api-client` already calls.
 *
 * HAND-WRITTEN, like every other file in `src/types/`. They mirror the
 * documented OpenAPI schemas of the same names; `client-surface.test.ts`
 * reads `apps/backend/openapi.json` and fails when a key set drifts.
 * Only `type` positions changed — no request URL, option or body is affected.
 */

/** `POST /client/bookings/:id/rate` → `ClientBookingRatingResponseDto`. */
export interface ClientBookingRating {
  id: string;
  bookingId: string;
  clientId: string;
  employeeId: string;
  /** 1–5 */
  score: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
}

/** `GET /client/bookings/:id/join` → `ClientBookingJoinResponseDto`. */
export interface ClientBookingJoinLink {
  joinUrl: string | null;
  scheduledAt: string;
}

/**
 * `reschedule` returns the controller-composed projection
 * (`ClientBookingMutationDto`). The projection is `Partial<Booking>` at the
 * source, so every field is typed as present but only the documented keys
 * are listed. Money fields (`price`, `priceSnapshot`) are Decimal strings.
 */
export interface ClientBookingMutation {
  id: string;
  bookingNumber: number;
  serviceId: string | null;
  employeeId: string;
  branchId: string;
  status: string;
  bookingType: string;
  deliveryType: string;
  scheduledAt: string;
  endsAt: string;
  durationMins: number;
  durationMinutesSnapshot: number | null;
  price: string;
  priceSnapshot: string | null;
  currency: string;
  payAtClinic: boolean;
  serviceNameSnapshot: string | null;
  employeeNameSnapshot: string | null;
  branchNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  zoomJoinUrl: string | null;
  zoomMeetingStatus: 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | null;
  createdAt: string;
  updatedAt: string;
  checkedInAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

/** `PATCH /client/bookings/:id/reschedule` → `ClientBookingRescheduleResponseDto`. */
export interface ClientBookingRescheduleResult {
  booking: ClientBookingMutation;
}

/** `POST /client/refunds/request` → `ClientRefundRequestResponseDto`. Amount in integer halalas. */
export interface ClientRefundRequestResult {
  id: string;
  status: string;
  amount: number;
  createdAt: string;
}

/**
 * `POST /client/packages/book` → `ClientBookingRecordDto` (the raw `Booking`
 * row). Only the fields consumers read are declared; the schema itself carries
 * every Prisma column.
 */
export interface ClientPackageBookingResult {
  id: string;
  status: string;
  packageCreditId: string | null;
}
