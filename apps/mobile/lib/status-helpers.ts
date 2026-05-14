import { BookingStatus } from '@/types/booking-enums';

/**
 * Maps all BookingStatus values to their corresponding i18n translation keys.
 * Matches the schema in apps/mobile/i18n/en.json and ar.json.
 */
export const STATUS_LABEL_MAP: Record<BookingStatus, string> = {
  pending: 'appointments.pending',
  pending_group_fill: 'appointments.pending',
  awaiting_payment: 'appointments.pending',
  confirmed: 'appointments.confirmed',
  completed: 'appointments.completed',
  cancelled: 'appointments.cancelledStatus',
  cancel_requested: 'appointments.pendingCancellation',
  no_show: 'appointments.noShow',
  expired: 'appointments.expired',
};

/**
 * Returns the i18n translation key for a given booking status.
 * Falls back to 'appointments.completed' if status is unknown, matching legacy behavior.
 */
export function getStatusLabel(status: BookingStatus): string {
  return STATUS_LABEL_MAP[status] || 'appointments.completed';
}
