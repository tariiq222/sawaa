import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { CheckAvailabilityHandler } from '../../check-availability/check-availability.handler';
import type { BookingType, DeliveryType } from '@prisma/client';

export interface AvailabilityDay {
  date: string; // YYYY-MM-DD (business TZ)
  hasSlots: boolean;
}

export interface GetPublicAvailabilityDaysQuery {
  employeeId: string;
  serviceId?: string;
  branchId?: string;
  /** Inclusive ISO date the window starts at. Defaults to today. */
  startDate?: string;
  /** How many consecutive days to check. Defaults to 14, capped at 31. */
  days?: number;
  /**
   * The wizard's selected duration option. Forwarded to every per-day probe so
   * the date strip greys days under the SAME duration context the slot fetch
   * will use — a day that only has slots for the service default must not
   * light up for a different option.
   */
  durationOptionId?: string;
  /** Explicit session duration in minutes; overrides the option lookup. */
  durationMins?: number;
  /** Delivery channel context (IN_PERSON / ONLINE). */
  deliveryType?: DeliveryType;
  /** Booking type context (legacy consumers). */
  bookingType?: BookingType | string;
}

/**
 * Cheap "any slot on this day?" probe for the wizard's date strip.
 * Returns one entry per requested day; greys out the day in the FE when
 * `hasSlots = false` so the user never lands on a dead-end date.
 */
@Injectable()
export class GetPublicAvailabilityDaysHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkAvailability: CheckAvailabilityHandler,
  ) {}

  async execute(query: GetPublicAvailabilityDaysQuery): Promise<AvailabilityDay[]> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId, isPublic: true, isActive: true },
      select: { id: true },
    });
    if (!employee) return [];

    let branchId = query.branchId;
    if (!branchId) {
      const eb = await this.prisma.employeeBranch.findFirst({
        where: { employeeId: query.employeeId },
        select: { branchId: true },
      });
      branchId = eb?.branchId;
    }
    let serviceId = query.serviceId;
    if (!serviceId) {
      const es = await this.prisma.employeeService.findFirst({
        where: { employeeId: query.employeeId },
        select: { serviceId: true },
      });
      serviceId = es?.serviceId;
    }
    if (!branchId || !serviceId) return [];

    const days = Math.max(1, Math.min(query.days ?? 14, 31));
    const start = query.startDate ? new Date(`${query.startDate}T00:00:00`) : new Date();
    start.setHours(0, 0, 0, 0);

    // Build the per-day probes and run them concurrently. Each probe is an
    // independent read against check-availability, so fanning them out with
    // Promise.all turns the sequential N-roundtrip strip into a single batch
    // without changing any result. Index `i` is preserved so the output order
    // still matches the requested window (day 0 first, day N-1 last).
    const dates: Date[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }

    return Promise.all(
      dates.map(async (d) => {
        const slots = await this.checkAvailability.execute({
          employeeId: query.employeeId,
          branchId,
          serviceId,
          date: d,
          // Day-strip probe: a missing ServiceBookingConfig must grey the days
          // out, not 400 the whole strip.
          silentOnMissingConfig: true,
          // Carry the user's selected duration/delivery context so the strip
          // matches the slot fetch that follows. Undefined values keep the
          // legacy default (service default option, IN_PERSON) for old callers.
          durationOptionId: query.durationOptionId,
          durationMins: query.durationMins,
          deliveryType: query.deliveryType,
          bookingType: query.bookingType,
        });
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return { date: `${y}-${m}-${day}`, hasSlots: slots.length > 0 };
      }),
    );
  }
}
