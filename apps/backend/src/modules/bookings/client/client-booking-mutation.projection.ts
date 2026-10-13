import type { Booking } from '@prisma/client';

// Mutations retain the established wire values, but never return staff notes,
// provider diagnostics or Zoom host capabilities from the domain Booking row.
const CLIENT_MUTATION_FIELDS = [
  'id', 'bookingNumber', 'serviceId', 'employeeId', 'branchId', 'status',
  'bookingType', 'deliveryType', 'scheduledAt', 'endsAt', 'durationMins',
  'durationMinutesSnapshot', 'price', 'priceSnapshot', 'currency', 'payAtClinic',
  'serviceNameSnapshot', 'employeeNameSnapshot', 'branchNameSnapshot', 'categoryNameSnapshot',
  'zoomJoinUrl', 'zoomMeetingStatus', 'createdAt', 'updatedAt', 'checkedInAt',
  'confirmedAt', 'completedAt', 'noShowAt', 'cancelledAt', 'cancelReason',
] as const satisfies readonly (keyof Booking)[];

export function projectClientBookingMutation(booking: Booking): Partial<Booking> {
  return Object.fromEntries(CLIENT_MUTATION_FIELDS
    .filter(field => Object.hasOwn(booking, field))
    .map(field => [field, booking[field]]));
}
