import { BookingStatus } from '@prisma/client';

export const STAFF_TIME_BLOCKING_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.PENDING_GROUP_FILL,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCEL_REQUESTED,
] as const;

export const GROUP_CAPACITY_BOOKING_STATUSES = [
  BookingStatus.PENDING_GROUP_FILL,
  BookingStatus.AWAITING_PAYMENT,
  BookingStatus.CONFIRMED,
] as const;
