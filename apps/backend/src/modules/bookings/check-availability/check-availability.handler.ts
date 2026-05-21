import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import type { BookingType, DeliveryType } from '@prisma/client';
import { CheckAvailabilityDto } from './check-availability.dto';
import { normalizeBookingTypes } from '../shared/delivery-type.helper';
import { combineYmdAndHmInBusinessTz, formatToBusinessYmd } from '../../../common/timezone';

export type CheckAvailabilityQuery = Omit<CheckAvailabilityDto, 'date' | 'durationOptionId' | 'bookingType' | 'deliveryType'> & {
  date: Date;
  durationOptionId?: string | null;
  bookingType?: BookingType | string | null;
  deliveryType?: DeliveryType | null;
  excludeBookingId?: string | null;
};

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
}

function slotInterval(durationMins: number): number {
  if (durationMins <= 15) return 15;
  if (durationMins <= 30) return 30;
  return 30; // for longer sessions, keep 30-min grid
}

/**
 * Parse an HH:mm business-hours string into a UTC Date anchored to the given
 * date. The anchor is a UTC Date representing a calendar day in Asia/Riyadh;
 * the HH:mm components are wall-clock Riyadh times stored in the DB.
 *
 * Uses `combineYmdAndHmInBusinessTz` (via `date-fns-tz`) so the result is
 * correct regardless of the process's local TZ.
 */
function parseHHmm(hhmm: string, anchor: Date): Date {
  const ymd = formatToBusinessYmd(anchor);
  return combineYmdAndHmInBusinessTz(ymd, hhmm);
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

    const normalizedTypes = normalizeBookingTypes({
      bookingType: query.bookingType,
      deliveryType: query.deliveryType,
    });

    // When the caller passes an explicit durationMins (> 0), trust it — it has
    // already been resolved upstream (e.g. PriceResolverService picks up employee
    // overrides that may diverge from the catalog option). The option lookup is
    // only a fallback for callers (portal / availability check) that pass a
    // durationOptionId or serviceId without a resolved duration.
    let durationMins = query.durationMins ?? 0;
    if (!durationMins && query.serviceId) {
      const option = await this.resolveDurationOption(
        query.serviceId,
        query.durationOptionId ?? null,
        normalizedTypes.bookingType,
        normalizedTypes.deliveryType,
      );
      if (option) durationMins = option.durationMins;
    }
    if (!durationMins) return [];

    const serviceOverrides = query.serviceId
      ? await this.prisma.service.findFirst({
          where: { id: query.serviceId },
          select: { bufferMinutes: true, minLeadMinutes: true, maxAdvanceDays: true },
        })
      : null;

    if (serviceOverrides?.maxAdvanceDays != null) {
      const svcMaxDate = new Date();
      svcMaxDate.setDate(svcMaxDate.getDate() + serviceOverrides.maxAdvanceDays);
      svcMaxDate.setHours(23, 59, 59, 999);
      if (dateOnly > svcMaxDate) return [];
    }

    const dayOfWeek = dateOnly.getDay();

    const [businessHour, holiday, shifts, exception, breaks, serviceConfig, serviceWindows] = await Promise.all([
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
      this.prisma.employeeBreak.findMany({
        where: { employeeId: query.employeeId, dayOfWeek },
        orderBy: { startTime: 'asc' },
      }),
      query.serviceId
        ? this.prisma.serviceBookingConfig.findUnique({
            where: {
              serviceId_deliveryType: {
                serviceId: query.serviceId,
                deliveryType: normalizedTypes.deliveryType,
              },
            },
            select: { useCustomAvailability: true },
          })
        : Promise.resolve(null),
      query.serviceId
        ? this.prisma.serviceAvailabilityWindow.findMany({
            where: {
              serviceId: query.serviceId,
              deliveryType: normalizedTypes.deliveryType,
              isActive: true,
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          })
        : Promise.resolve([]),
    ]);

    if (!businessHour || !businessHour.isOpen) return [];
    if (holiday) return [];
    if (shifts.length === 0) return [];

    const employeeBranch = await this.prisma.employeeBranch.findUnique({
      where: { employeeId_branchId: { employeeId: query.employeeId, branchId: query.branchId } },
      select: { id: true },
    });
    if (!employeeBranch) return [];

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

    let baseWindows: [Date, Date][] = [branchWindow];
    if (serviceConfig?.useCustomAvailability) {
      if (serviceWindows.length === 0) return [];

      baseWindows = serviceWindows
        .filter((window) => window.dayOfWeek === dayOfWeek)
        .map((window) => intersectWindows(branchWindow, [
          parseHHmm(window.startTime, dateOnly),
          parseHHmm(window.endTime, dateOnly),
        ] as [Date, Date]))
        .filter((window): window is [Date, Date] => !!window);

      if (baseWindows.length === 0) return [];
    }

    const windows: [Date, Date][] = [];
    for (const shift of shifts) {
      const shiftWindow: [Date, Date] = [
        parseHHmm(shift.startTime, dateOnly),
        parseHHmm(shift.endTime, dateOnly),
      ];
      for (const baseWindow of baseWindows) {
        let intersection = intersectWindows(shiftWindow, baseWindow);
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
    }

    // Subtract employee breaks from available windows
    const adjustedWindows: [Date, Date][] = [];
    for (const [wStart, wEnd] of windows) {
      let segments: [Date, Date][] = [[wStart, wEnd]];
      for (const brk of breaks) {
        const brkStart = parseHHmm(brk.startTime, dateOnly);
        const brkEnd = parseHHmm(brk.endTime, dateOnly);
        const next: [Date, Date][] = [];
        for (const [sStart, sEnd] of segments) {
          if (brkEnd <= sStart || brkStart >= sEnd) {
            next.push([sStart, sEnd]); // no overlap
          } else {
            if (sStart < brkStart) next.push([sStart, brkStart]);
            if (brkEnd < sEnd) next.push([brkEnd, sEnd]);
          }
        }
        segments = next;
      }
      adjustedWindows.push(...segments);
    }

    if (adjustedWindows.length === 0) return [];

    const latestEnd = adjustedWindows[adjustedWindows.length - 1][1];

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        employeeId: query.employeeId,
        ...(query.excludeBookingId ? { id: { not: query.excludeBookingId } } : {}),
        status: { in: ['PENDING', 'PENDING_GROUP_FILL', 'CONFIRMED', 'AWAITING_PAYMENT'] },
        scheduledAt: { lt: latestEnd },
        durationMins: { gt: 0 },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const effectiveMinLead = serviceOverrides?.minLeadMinutes ?? settings.minBookingLeadMinutes;
    const effectiveBuffer = serviceOverrides?.bufferMinutes ?? settings.bufferMinutes;
    const earliestAllowed = new Date(Date.now() + effectiveMinLead * 60_000);
    const bufferMs = effectiveBuffer * 60_000;

    const slots: AvailableSlot[] = [];

    for (const [windowStart, windowEnd] of adjustedWindows) {
      let cursor = new Date(windowStart);
      while (cursor.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + durationMins * 60_000);

        const hasConflict = existingBookings.some((b) => {
          const bStart = new Date(b.scheduledAt.getTime() - bufferMs);
          const bEnd = new Date(b.scheduledAt.getTime() + b.durationMins * 60_000 + bufferMs);
          return bStart < slotEnd && bEnd > cursor;
        });

        if (!hasConflict && cursor >= earliestAllowed) {
          slots.push({ startTime: new Date(cursor), endTime: slotEnd });
        }

        cursor = new Date(cursor.getTime() + slotInterval(durationMins) * 60_000);
      }
    }

    return slots;
  }

  private async resolveDurationOption(
    serviceId: string,
    durationOptionId: string | null,
    _bookingType: BookingType | null,
    deliveryType: DeliveryType | null,
  ) {
    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, serviceId, isActive: true },
        select: { durationMins: true },
      });
    }
    if (deliveryType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, deliveryType, isDefault: true, isActive: true },
        select: { durationMins: true },
      });
      if (scoped) return scoped;
    }
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isDefault: true, isActive: true },
      select: { durationMins: true },
    });
    if (global) return global;
    return this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isActive: true },
      orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      select: { durationMins: true },
    });
  }
}
