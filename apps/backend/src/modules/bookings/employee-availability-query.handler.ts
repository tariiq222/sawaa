import { Injectable } from '@nestjs/common';
import type { DeliveryType } from '@prisma/client';
import { CheckAvailabilityHandler } from './check-availability/check-availability.handler';
import { GetMainBranchHandler } from '../org-config/branches/get-main-branch.handler';

export interface EmployeeSlotQuery {
  employeeId: string;
  date: string;
  duration?: number;
  branchId?: string;
  serviceId?: string;
  deliveryType?: string;
}

export interface EmployeeAvailableDaysQuery {
  employeeId: string;
  startDate: string;
  days?: number;
  duration?: number;
  branchId?: string;
  serviceId?: string;
  deliveryType?: string;
}

function formatHHmm(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function formatDateYmd(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Injectable()
export class EmployeeAvailabilityQueryHandler {
  constructor(
    private readonly checkAvailability: CheckAvailabilityHandler,
    private readonly getMainBranch: GetMainBranchHandler,
  ) {}

  async slots(query: EmployeeSlotQuery) {
    const branchId = query.branchId ?? (await this.getMainBranch.execute()).id;
    const slots = await this.checkAvailability.execute({
      employeeId: query.employeeId,
      branchId,
      date: new Date(query.date),
      durationMins: query.duration,
      serviceId: query.serviceId,
      deliveryType: query.deliveryType as DeliveryType | undefined,
    });
    return slots.map((slot) => ({
      startTime: formatHHmm(slot.startTime),
      endTime: formatHHmm(slot.endTime),
    }));
  }

  async availableDays(query: EmployeeAvailableDaysQuery) {
    const branchId = query.branchId ?? (await this.getMainBranch.execute()).id;
    const horizon = Math.min(query.days ?? 30, 90);
    const start = new Date(query.startDate);
    const dates = Array.from({ length: horizon }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
    const results = await Promise.all(
      dates.map(async (date) => {
        const slots = await this.checkAvailability.execute({
          employeeId: query.employeeId,
          branchId,
          date,
          durationMins: query.duration,
          serviceId: query.serviceId,
          deliveryType: query.deliveryType as DeliveryType | undefined,
          // Day-strip probe: a missing ServiceBookingConfig must disable the
          // day chips, not 400 the whole strip.
          silentOnMissingConfig: true,
        });
        return slots.length > 0 ? formatDateYmd(date) : null;
      }),
    );
    return results.filter((date): date is string => !!date);
  }
}
