/**
 * Canonical Booking enum values for the mobile app.
 *
 * Wire format: the backend's `mapBookingRow` (booking-row.mapper.ts) emits
 * lowercase snake_case strings on the read side, and the
 * `ListBookingsDto` validators upper-case incoming filter values via
 * `@Transform`, so the mobile canonical type uses lowercase snake_case both
 * ways.
 *
 * Mapping vs the Prisma enum:
 *   Prisma BookingType  → wire
 *     INDIVIDUAL          in_person   (the mapper renames this for the UI)
 *     ONLINE              online
 *     WALK_IN             walk_in
 *     GROUP               group
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
 */
export type BookingType = 'in_person' | 'online' | 'walk_in' | 'group';

export type BookingStatus =
  | 'pending'
  | 'pending_group_fill'
  | 'awaiting_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'cancel_requested'
  | 'no_show'
  | 'expired';
