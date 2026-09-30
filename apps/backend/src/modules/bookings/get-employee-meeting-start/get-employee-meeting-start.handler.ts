import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType, ZoomMeetingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

/** Statuses in which an assigned employee may still host the session. */
const STARTABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DEPOSIT_PAID,
];

export interface GetEmployeeMeetingStartQuery {
  bookingId: string;
  employeeId: string;
}

/**
 * The only path that hands the Zoom host (start) URL to a caller. The list and
 * detail mappers strip it (see MapBookingRowOptions.includeHostUrls); here the
 * assigned employee is verified as the booking's host before it is returned.
 */
@Injectable()
export class GetEmployeeMeetingStartHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetEmployeeMeetingStartQuery) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: query.bookingId },
      select: {
        id: true,
        employeeId: true,
        status: true,
        deliveryType: true,
        scheduledAt: true,
        durationMins: true,
        zoomMeetingStatus: true,
        zoomStartUrl: true,
      },
    });
    if (!booking) throw new NotFoundException(`Booking ${query.bookingId} not found`);
    if (booking.employeeId !== query.employeeId) {
      throw new ForbiddenException('Booking is not assigned to you');
    }
    if (booking.deliveryType !== DeliveryType.ONLINE) {
      throw new ForbiddenException('Only online bookings have a meeting to start');
    }
    if (!STARTABLE_STATUSES.includes(booking.status)) {
      throw new ForbiddenException('The meeting cannot be started for this booking');
    }

    const ready = booking.zoomMeetingStatus === ZoomMeetingStatus.CREATED && Boolean(booking.zoomStartUrl);
    return {
      bookingId: booking.id,
      scheduledAt: booking.scheduledAt.toISOString(),
      durationMins: booking.durationMins,
      meetingStatus: booking.zoomMeetingStatus ?? null,
      startUrl: ready ? booking.zoomStartUrl : null,
    };
  }
}
