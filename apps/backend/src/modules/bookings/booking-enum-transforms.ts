import { BookingType } from '@prisma/client';

/**
 * Dashboard, mobile, and the public website send the delivery channel as the UI's
 * snake_case alias (in_person / online), but the Prisma `DeliveryType` enum is uppercase
 * (IN_PERSON / ONLINE). Normalise before `@IsEnum` validation so every booking-creation
 * DTO accepts the alias instead of rejecting it with a 400. Non-string values pass through
 * untouched so `@IsEnum` still reports them.
 */
export const mapDeliveryType = (v: unknown): unknown =>
  typeof v === 'string' && v ? v.toUpperCase() : v;

/**
 * Same alias problem for the appointment shape: older consumers send the UI's
 * snake_case `in_person` (meaning INDIVIDUAL) or a lowercase enum spelling.
 * Uppercase before validation so the strict allowlist below accepts the
 * aliases; non-strings pass through untouched so the validator still reports
 * them.
 */
export const mapBookingType = (v: unknown): unknown => {
  if (typeof v !== 'string' || !v) return v;
  if (v.toLowerCase() === 'in_person') return 'INDIVIDUAL';
  return v.toUpperCase();
};

/**
 * Strict allowlist for the public availability probes: the real BookingType
 * enum values plus the legacy 'ONLINE' delivery alias. 'ONLINE' must stay
 * valid here because normalizeBookingTypes() downstream derives
 * deliveryType=ONLINE from it — rejecting it at the DTO would silently flip
 * legacy clients to in-person availability.
 */
export const PUBLIC_BOOKING_TYPE_ALLOWLIST: readonly string[] = [
  ...Object.values(BookingType),
  'ONLINE',
];
