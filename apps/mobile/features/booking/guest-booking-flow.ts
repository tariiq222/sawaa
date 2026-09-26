import type { DeliveryType } from '@/types/booking-enums';

export interface BookingReturn {
  serviceId: string;
  employeeId: string;
  branchId: string;
  deliveryType: DeliveryType;
  scheduledAt: string;
  durationOptionId?: string;
  amount: string;
  currency: string;
}

export function bookingStepPath(step: 'schedule' | 'confirm', signedIn: boolean): string {
  return signedIn ? `/(client)/booking/${step}` : `/public-booking/${step}`;
}

export function encodeBookingReturn(booking: BookingReturn): string {
  return JSON.stringify(booking);
}

export function decodeBookingReturn(value: string | undefined): BookingReturn | null {
  if (!value) return null;
  try {
    const booking: unknown = JSON.parse(value);
    if (!booking || typeof booking !== 'object') return null;
    const row = booking as Record<string, unknown>;
    if (!['serviceId', 'employeeId', 'branchId', 'scheduledAt', 'amount', 'currency']
      .every((key) => typeof row[key] === 'string' && (row[key] as string).length > 0)) return null;
    if (row.deliveryType !== 'online' && row.deliveryType !== 'in_person') return null;
    if (!Number.isFinite(Date.parse(row.scheduledAt as string))) return null;
    if (!/^\d+$/.test(row.amount as string) || Number(row.amount) <= 0) return null;
    if (row.durationOptionId != null && typeof row.durationOptionId !== 'string') return null;
    return {
      serviceId: row.serviceId as string,
      employeeId: row.employeeId as string,
      branchId: row.branchId as string,
      deliveryType: row.deliveryType,
      scheduledAt: row.scheduledAt as string,
      ...(row.durationOptionId ? { durationOptionId: row.durationOptionId as string } : {}),
      amount: row.amount as string,
      currency: row.currency as string,
    };
  } catch {
    return null;
  }
}
