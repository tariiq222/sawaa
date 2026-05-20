import { BookingType, DeliveryType } from '@prisma/client';

export interface NormalizedBookingTypes {
  bookingType: BookingType;
  deliveryType: DeliveryType;
}

/**
 * Normalize legacy bookingType values into the new (bookingType, deliveryType) pair.
 *
 * Legacy mapping (for backward compatibility with old clients):
 *   bookingType='ONLINE'  → bookingType=INDIVIDUAL, deliveryType=ONLINE
 *   bookingType='in_person' (UI snake_case) → bookingType=INDIVIDUAL, deliveryType=IN_PERSON
 *
 * New model:
 *   bookingType = INDIVIDUAL | GROUP | WALK_IN
 *   deliveryType = IN_PERSON | ONLINE
 *   WALK_IN always maps to IN_PERSON
 *   GROUP supports both IN_PERSON and ONLINE
 */
export function normalizeBookingTypes(input: {
  bookingType?: BookingType | string | null;
  deliveryType?: DeliveryType | string | null;
}): NormalizedBookingTypes {
  let bookingType: BookingType | undefined;
  let deliveryType: DeliveryType | undefined;

  // Determine raw bookingType
  const rawBookingType =
    typeof input.bookingType === 'string' ? input.bookingType.toUpperCase() : input.bookingType;

  // Determine raw deliveryType
  const rawDeliveryType =
    typeof input.deliveryType === 'string' ? input.deliveryType.toUpperCase() : input.deliveryType;

  // Legacy: 'in_person' sent as bookingType (UI snake_case alias)
  if (typeof input.bookingType === 'string' && input.bookingType.toLowerCase() === 'in_person') {
    bookingType = BookingType.INDIVIDUAL;
    deliveryType = DeliveryType.IN_PERSON;
  }
  // Legacy: 'ONLINE' sent as bookingType
  else if (rawBookingType === 'ONLINE') {
    bookingType = BookingType.INDIVIDUAL;
    deliveryType = DeliveryType.ONLINE;
  }
  // New model: explicit bookingType + optional deliveryType
  else if (rawBookingType && Object.values(BookingType).includes(rawBookingType as BookingType)) {
    bookingType = rawBookingType as BookingType;
  }

  // If deliveryType was explicitly provided, it overrides the legacy-derived value
  if (rawDeliveryType && Object.values(DeliveryType).includes(rawDeliveryType as DeliveryType)) {
    deliveryType = rawDeliveryType as DeliveryType;
  }

  // Defaults
  if (!bookingType) {
    bookingType = BookingType.INDIVIDUAL;
  }

  if (!deliveryType) {
    if (bookingType === BookingType.WALK_IN) {
      deliveryType = DeliveryType.IN_PERSON;
    } else if (bookingType === BookingType.GROUP) {
      // GROUP defaults to IN_PERSON when not specified
      deliveryType = DeliveryType.IN_PERSON;
    } else {
      // INDIVIDUAL defaults to IN_PERSON when not specified
      deliveryType = DeliveryType.IN_PERSON;
    }
  }

  return { bookingType, deliveryType };
}

/**
 * Check whether a booking requires Zoom based on its delivery type.
 * Zoom is only required when deliveryType=ONLINE AND an explicit Zoom config exists.
 *
 * This replaces the old logic that checked bookingType === 'ONLINE'.
 */
export function requiresZoom(deliveryType: DeliveryType): boolean {
  return deliveryType === DeliveryType.ONLINE;
}
