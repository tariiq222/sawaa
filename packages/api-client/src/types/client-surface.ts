/**
 * Response types for the authenticated `/client` surface routes that
 * `packages/api-client` already calls.
 *
 * DERIVED from the generated OpenAPI snapshot (`./generated/openapi`), one
 * type per operation. Only `type` positions are affected — no request URL,
 * option or body changes.
 */
import type { components } from './generated/openapi'

type Schemas = components['schemas']

/** `POST /client/bookings/:id/rate` → `ClientBookingRatingResponseDto`. */
export type ClientBookingRating = Schemas['ClientBookingRatingResponseDto']

/** `GET /client/bookings/:id/join` → `ClientBookingJoinResponseDto`. */
export type ClientBookingJoinLink = Schemas['ClientBookingJoinResponseDto']

/**
 * `PATCH /client/bookings/:id/reschedule` body projection
 * (`ClientBookingMutationDto`). Money fields (`price`, `priceSnapshot`) are
 * Decimal strings; `durationMins` is the documented duration.
 */
export type ClientBookingMutation = Schemas['ClientBookingMutationDto']

/** `PATCH /client/bookings/:id/reschedule` → `ClientBookingRescheduleResponseDto`. */
export type ClientBookingRescheduleResult = Schemas['ClientBookingRescheduleResponseDto']

/** `POST /client/refunds/request` → `ClientRefundRequestResponseDto`. Amount in integer halalas. */
export type ClientRefundRequestResult = Schemas['ClientRefundRequestResponseDto']

/**
 * `POST /client/packages/book` → `ClientBookingRecordDto` (the raw `Booking`
 * row). Projected to the three fields consumers read.
 */
export type ClientPackageBookingResult = Pick<
  Schemas['ClientBookingRecordDto'],
  'id' | 'status' | 'packageCreditId'
>
