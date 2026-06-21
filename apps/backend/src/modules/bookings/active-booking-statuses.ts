import { BookingStatus } from '@prisma/client';

export const STAFF_TIME_BLOCKING_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCEL_REQUESTED,
  // A deposit-paid booking reserves the employee's time even though a balance is still due.
  BookingStatus.DEPOSIT_PAID,
] as const;
