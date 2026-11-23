/**
 * Canonical booking enum values for the mobile app.
 *
 * Wire format: the backend's `mapBookingRow` (booking-row.mapper.ts) emits
 * lowercase snake_case strings on the read side, and the
 * `ListBookingsDto` validators upper-case incoming filter values via
 * `@Transform`, so the mobile canonical type uses lowercase snake_case both
 * ways for read models and list filters.
 *
 * BookingType is the appointment/category type only. DeliveryType is the
 * channel for the session. It is a read-model concern for client bookings;
 * the mobile create-booking DTO does not accept it.
 *
 * Mapping vs the Prisma enums:
 *   Prisma BookingType  → wire
 *     INDIVIDUAL          individual
 *     WALK_IN             walk_in
 *     GROUP               group
 *
 *   Prisma DeliveryType → wire
 *     IN_PERSON           in_person
 *     ONLINE              online
 *
 *   Prisma BookingStatus → wire
 *     PENDING             pending
 *     PENDING_GROUP_FILL  pending_group_fill
 *     AWAITING_PAYMENT    awaiting_payment
 *     CONFIRMED           confirmed
 *     CANCELLED           cancelled
 *     COMPLETED           completed
 *     NO_SHOW             no_show
 *     EXPIRED             expired
 *     CANCEL_REQUESTED    cancel_requested
 *     DEPOSIT_PAID        deposit_paid
 *
 * The table and the union below are guarded against the committed OpenAPI
 * snapshot by `__tests__/booking-status-parity.test.ts`; update both together.
 */
export type BookingType = 'individual' | 'walk_in' | 'group';

export type DeliveryType = 'in_person' | 'online';

/** Legacy read boundary for older responses that overloaded bookingType/type. */
export type LegacyBookingType = BookingType | DeliveryType;

export function resolveDeliveryType(
  deliveryType?: DeliveryType | string | null,
): DeliveryType {
  if (deliveryType === 'online' || deliveryType === 'in_person') return deliveryType;
  return 'in_person';
}

/**
 * Legacy response adapter only. Do not use it to construct request payloads.
 */
export function resolveDeliveryTypeFromLegacyResponse(
  deliveryType?: DeliveryType | string | null,
  legacyType?: LegacyBookingType | string | null,
): DeliveryType {
  const explicitDeliveryType = resolveDeliveryType(deliveryType);
  if (deliveryType === 'online' || deliveryType === 'in_person') return explicitDeliveryType;
  if (legacyType === 'online') return 'online';
  return 'in_person';
}

export function resolveBookingType(
  bookingType?: LegacyBookingType | string | null,
): BookingType {
  if (bookingType === 'group' || bookingType === 'walk_in' || bookingType === 'individual') {
    return bookingType;
  }

  return 'individual';
}

export function hasZoomMeetingAccess(input: {
  deliveryType?: DeliveryType | string | null;
  bookingType?: LegacyBookingType | string | null;
  type?: LegacyBookingType | string | null;
  zoomLink?: string | null;
  zoomJoinUrl?: string | null;
  zoomStartUrl?: string | null;
  zoomMeetingStatus?: string | null;
}): boolean {
  const deliveryType = resolveDeliveryTypeFromLegacyResponse(
    input.deliveryType,
    input.bookingType ?? input.type,
  );

  return deliveryType === 'online' && Boolean(
    input.zoomLink ||
      input.zoomJoinUrl ||
      input.zoomStartUrl ||
      input.zoomMeetingStatus,
  );
}

/**
 * The wire statuses, in one runtime list.
 *
 * `BookingStatus` is a type and disappears at runtime, so any code that needs
 * to validate or enumerate statuses must read this array. It is kept next to
 * the union so both change together, and the parity test in
 * `__tests__/booking-status-parity.test.ts` asserts this list matches the
 * committed OpenAPI snapshot. Do not write another status list by hand.
 */
export const BOOKING_STATUSES = [
  'pending',
  'pending_group_fill',
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
  'cancel_requested',
  'deposit_paid',
] as const satisfies readonly BookingStatus[];

export type BookingStatus =
  | 'pending'
  | 'pending_group_fill'
  | 'awaiting_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired'
  | 'cancel_requested'
  | 'deposit_paid';
