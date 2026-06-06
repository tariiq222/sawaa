/**
 * Dashboard, mobile, and the public website send the delivery channel as the UI's
 * snake_case alias (in_person / online), but the Prisma `DeliveryType` enum is uppercase
 * (IN_PERSON / ONLINE). Normalise before `@IsEnum` validation so every booking-creation
 * DTO accepts the alias instead of rejecting it with a 400. Non-string values pass through
 * untouched so `@IsEnum` still reports them.
 */
export const mapDeliveryType = (v: unknown): unknown =>
  typeof v === 'string' && v ? v.toUpperCase() : v;
