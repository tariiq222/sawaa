import { DeliveryType } from '@prisma/client';

/**
 * Normalizes new deliveryType inputs plus legacy bookingType delivery aliases.
 *
 * Legacy aliases are accepted only at DTO/handler boundaries so persistence
 * continues to use the required DeliveryType column exclusively.
 */
export function normalizeDeliveryTypeInput(value?: DeliveryType | string | null): DeliveryType {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'IN_PERSON' || normalized === 'IN-PERSON') return DeliveryType.IN_PERSON;
    if (normalized === 'ONLINE') return DeliveryType.ONLINE;
  }
  if (value === DeliveryType.ONLINE) return DeliveryType.ONLINE;
  return DeliveryType.IN_PERSON;
}
