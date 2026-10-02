import type { DeliveryType } from '@/types/booking-enums';

export interface BookingReturn {
  clinicId?: string;
  serviceId: string;
  employeeId: string;
  branchId: string;
  deliveryType: DeliveryType;
  scheduledAt: string;
  durationOptionId?: string;
  amount: string;
  currency: string;
  steps?: string;
}

export function bookingStepPath(step: 'service' | 'schedule' | 'confirm', signedIn: boolean): string {
  return signedIn ? `/(client)/booking/${step}` : `/public-booking/${step}`;
}

export function authContinuationParams(booking?: string, redirect?: string): {
  booking?: string;
  redirect?: string;
} {
  return {
    ...(booking ? { booking } : {}),
    ...(redirect ? { redirect } : {}),
  };
}

export function authLoginHref(booking?: string, redirect?: string) {
  return {
    pathname: '/(auth)/login' as const,
    params: authContinuationParams(booking, redirect),
  };
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
    if (row.clinicId != null && (typeof row.clinicId !== 'string' || row.clinicId.length === 0)) return null;
    if (!['serviceId', 'employeeId', 'branchId', 'scheduledAt', 'amount', 'currency']
      .every((key) => typeof row[key] === 'string' && (row[key] as string).length > 0)) return null;
    if (row.deliveryType !== 'online' && row.deliveryType !== 'in_person') return null;
    if (!Number.isFinite(Date.parse(row.scheduledAt as string))) return null;
    const amount = row.amount as string;
    const amountInHalalas = Number(amount);
    if (!/^\d+$/.test(amount) || !Number.isSafeInteger(amountInHalalas) || amountInHalalas < 0) return null;
    if (row.durationOptionId != null && typeof row.durationOptionId !== 'string') return null;
    return {
      ...(typeof row.clinicId === 'string' ? { clinicId: row.clinicId } : {}),
      serviceId: row.serviceId as string,
      employeeId: row.employeeId as string,
      branchId: row.branchId as string,
      deliveryType: row.deliveryType,
      scheduledAt: row.scheduledAt as string,
      ...(row.durationOptionId ? { durationOptionId: row.durationOptionId as string } : {}),
      amount: row.amount as string,
      currency: row.currency as string,
      ...(typeof row.steps === 'string' && row.steps.length > 0 ? { steps: row.steps } : {}),
    };
  } catch {
    return null;
  }
}
