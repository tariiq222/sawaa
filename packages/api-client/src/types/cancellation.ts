import type { components, paths } from './generated/openapi'

type Schemas = components['schemas']

/** Cancel 200 body of `PATCH /api/v1/client/bookings/{id}/cancel`. */
type ClientCancelResponse =
  paths['/api/v1/client/bookings/{id}/cancel']['patch']['responses'][200]['content']['application/json']

/** Cancellation policy amounts are integer halalas (`CancellationRefundSummaryDto`). */
export type CancellationRefund = Schemas['CancellationRefundSummaryDto']

/** Persisted refund record (`PersistedCancellationRefundDto`). */
export type PersistedCancellationRefund = Schemas['PersistedCancellationRefundDto']

/** 200 body of `GET /api/v1/client/bookings/{id}/cancellation-preview` (`ClientCancellationPreviewDto`). */
export type CancellationPreview = Schemas['ClientCancellationPreviewDto']

/** Consent + quote slice of the cancel request body (`ClientCancelBookingRequestDto`). */
export type CancellationQuoteInput = Pick<
  Schemas['ClientCancelBookingRequestDto'],
  'acceptedRefundTerms' | 'quoteToken' | 'sourceActionId'
>

/** 200 body of `PATCH /api/v1/client/bookings/{id}/cancel` (controller-composed projection). */
export type ClientCancellationResult = {
  status: ClientCancelResponse['status']
  /**
   * Documented only as a bare `object`, which openapi-typescript renders as
   * `Record<string, never>`. Kept as `unknown` (the old contract) so callers
   * are not forced into an impossible empty-record shape.
   */
  booking: unknown
  requiresApproval: ClientCancelResponse['requiresApproval']
  refund?: NonNullable<ClientCancelResponse['refund']>
}
