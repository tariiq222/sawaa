import type { ClientBookingRow } from '@/services/client/bookings';

/** Prefer the booked snapshot over a potentially renamed legacy catalog relation. */
export function getBookingServiceName(booking: ClientBookingRow, isRTL: boolean): string | null {
  const snapshots = isRTL
    ? [booking.serviceNameAr, booking.serviceName]
    : [booking.serviceName, booking.serviceNameAr];
  const legacyNames = isRTL
    ? [booking.service?.nameAr, booking.service?.nameEn]
    : [booking.service?.nameEn, booking.service?.nameAr];

  for (const name of [...snapshots, ...legacyNames]) {
    if (name?.trim()) return name.trim();
  }
  return null;
}
