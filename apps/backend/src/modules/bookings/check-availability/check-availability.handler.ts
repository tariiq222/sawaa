import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import type { BookingType } from '@prisma/client';
import { CheckAvailabilityDto } from './check-availability.dto';

export type CheckAvailabilityQuery = Omit<CheckAvailabilityDto, 'date' | 'durationOptionId' | 'bookingType'> & {
  date: Date;
  durationOptionId?: string | null;
  bookingType?: BookingType | null;
};

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
}

const SLOT_INTERVAL_MINS = 30;

function parseHHmm(hhmm: string, anchor: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(anchor);
  d.setHours(h, m, 0, 0);
  return d;
}

function intersectWindows(a: [Date, Date], b: [Date, Date]): [Date, Date] | null {
  const start = a[0] > b[0] ? a[0] : b[0];
  const end = a[1] < b[1] ? a[1] : b[1];
  return start < end ? [start, end] : null;
}

@Injectable()
export class CheckAvailabilityHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsHandler: GetBookingSettingsHandler,
  ) {}

  async execute(query: CheckAvailabilityQuery): Promise<AvailableSlot[]> {
    const settings = await this.settingsHandler.execute({
      branchId: query.branchId,
    });

    const dateOnly = new Date(query.date);
    dateOnly.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + settings.maxAdvanceBookingDays);
    maxDate.setHours(23, 59, 59, 999);
    if (dateOnly > maxDate) return [];

    let durationMins = query.durationMins ?? 0;
    if (query.serviceId) {
      const option = await this.resolveDurationOption(
        query.serviceId,
        query.durationOptionId ?? null,
        query.bookingType ?? null,
      );
      if (option) durationMins = option.durationMins;
    }
    if (!durationMins) return [];

    const dayOfWeek = dateOnly.getDay();

    const [businessHour, holiday, shifts, exception] = await Promise.all([
      this.prisma.businessHour.findUnique({
        where: { branchId_dayOfWeek: { branchId: query.branchId, dayOfWeek } },
      }),
      this.prisma.holiday.findFirst({
        where: { branchId: query.branchId, date: dateOnly },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: query.employeeId, dayOfWeek, isActive: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.employeeAvailabilityException.findFirst({
        where: {
          employeeId: query.employeeId,
          startDate: { lte: dateOnly },
          endDate: { gte: dateOnly },
        },
      }),
    ]);

    if (!businessHour || !businessHour.isOpen) return [];
    if (holiday) return [];
    if (shifts.length === 0) return [];

    // Exception handling: full block unless it's the last day AND endTime is set,
    // in which case the day is only blocked up to endTime.
    let exceptionCutoff: Date | null = null;
    if (exception) {
      const isLastDay =
        exception.endDate.getFullYear() === dateOnly.getFullYear() &&
        exception.endDate.getMonth() === dateOnly.getMonth() &&
        exception.endDate.getDate() === dateOnly.getDate();
      if (!isLastDay || !exception.endTime) return [];
      exceptionCutoff = exception.endTime;
    }

    const branchWindow: [Date, Date] = [
      parseHHmm(businessHour.startTime, dateOnly),
      parseHHmm(businessHour.endTime, dateOnly),
    ];

    const windows: [Date, Date][] = [];
    for (const shift of shifts) {
      const shiftWindow: [Date, Date] = [
        parseHHmm(shift.startTime, dateOnly),
        parseHHmm(shift.endTime, dateOnly),
      ];
      let intersection = intersectWindows(shiftWindow, branchWindow);
      if (intersection && exceptionCutoff) {
        // Block the day up to exceptionCutoff (exception ends at this time — work resumes after)
        if (intersection[1] <= exceptionCutoff) {
          intersection = null;
        } else if (intersection[0] < exceptionCutoff) {
          intersection = [exceptionCutoff, intersection[1]];
        }
      }
      if (intersection) windows.push(intersection);
    }

    if (windows.length === 0) return [];

    const earliestStart = windows[0][0];
    const latestEnd = windows[windows.length - 1][1];

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        employeeId: query.employeeId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledAt: { gte: earliestStart, lt: latestEnd },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const earliestAllowed = new Date(Date.now() + settings.minBookingLeadMinutes * 60_000);
    const bufferMs = settings.bufferMinutes * 60_000;

    const slots: AvailableSlot[] = [];

    for (const [windowStart, windowEnd] of windows) {
      let cursor = new Date(windowStart);
      while (cursor.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + durationMins * 60_000);

        const hasConflict = existingBookings.some((b) => {
          const bEnd = new Date(b.scheduledAt.getTime() + b.durationMins * 60_000 + bufferMs);
          return b.scheduledAt < slotEnd && bEnd > cursor;
        });

        if (!hasConflict && cursor >= earliestAllowed) {
          slots.push({ startTime: new Date(cursor), endTime: slotEnd });
        }

        cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MINS * 60_000);
      }
    }

    return slots;
  }

  private async resolveDurationOption(
    serviceId: string,
    durationOptionId: string | null,
    bookingType: BookingType | null,
  ) {
    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, serviceId, isActive: true },
        select: { durationMins: true },
      });
    }
    if (bookingType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, bookingType, isDefault: true, isActive: true },
        select: { durationMins: true },
      });
      if (scoped) return scoped;
    }
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, bookingType: null, isDefault: true, isActive: true },
      select: { durationMins: true },
    });
    if (global) return global;
    return this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isActive: true },
      orderBy: [{ bookingType: 'asc' }, { sortOrder: 'asc' }],
      select: { durationMins: true },
    });
  }
}
