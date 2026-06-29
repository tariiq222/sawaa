import api from '@/services/api';
import type { DeliveryType } from '@/types/booking-enums';

/**
 * Priced duration/delivery options for a specific practitioner+service pair.
 * Mirrors the website's `getPractitionerBookingOptions` so mobile charges the
 * same price the website would (P1-22: mobile previously showed the service
 * base price instead of the practitioner's actual charged price).
 *
 * Endpoint: GET /public/services/:serviceId/practitioners/:employeeId/booking-options
 */
export interface PractitionerBookingOption {
  /** Wire enum from the backend is upper snake_case (IN_PERSON | ONLINE). */
  deliveryType: 'IN_PERSON' | 'ONLINE';
  durationOptionId: string;
  durationMins: number;
  /** Net price in integer halalas (VAT/total are computed server-side). */
  price: number;
  currency: string;
  label: string | null;
}

export interface PractitionerBookingOptions {
  useCustomPricing: boolean;
  disabledDeliveryTypes: Array<'IN_PERSON' | 'ONLINE'>;
  options: PractitionerBookingOption[];
}

/** Map the backend upper snake_case delivery enum to the mobile wire value. */
export function toMobileDeliveryType(
  deliveryType: 'IN_PERSON' | 'ONLINE',
): DeliveryType {
  return deliveryType === 'ONLINE' ? 'online' : 'in_person';
}

export async function getPractitionerBookingOptions(
  serviceId: string,
  employeeId: string,
): Promise<PractitionerBookingOptions> {
  const response = await api.get<PractitionerBookingOptions>(
    `/public/services/${serviceId}/practitioners/${employeeId}/booking-options`,
  );
  return response.data;
}
