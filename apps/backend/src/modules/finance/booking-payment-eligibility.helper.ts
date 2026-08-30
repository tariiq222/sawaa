import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

const NON_PAYABLE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.CANCEL_REQUESTED,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
]);

export function assertBookingAcceptsPayment(
  bookingId: string,
  status: BookingStatus | string | null | undefined,
): void {
  if (status && NON_PAYABLE_BOOKING_STATUSES.has(status as BookingStatus)) {
    throw new BadRequestException(
      `Booking ${bookingId} cannot accept payments (booking status: ${status})`,
    );
  }
}
