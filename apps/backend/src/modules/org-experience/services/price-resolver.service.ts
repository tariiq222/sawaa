import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { BookingType } from '@prisma/client';

export interface ResolvedPrice {
  price: number;
  durationMins: number;
  durationOptionId: string;
  currency: string;
  /** true when the price/duration came from an employee-level override */
  isEmployeeOverride: boolean;
}

@Injectable()
export class PriceResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves final price + duration for a booking, following priority order:
   *
   * 1. EmployeeServiceOption.priceOverride / durationOverride (per-employee override)
   * 2. ServiceDurationOption.price / durationMins (catalog option)
   * 3. Service.price / durationMins (service-level fallback)
   *
   * @param serviceId   - the service being booked
   * @param employeeServiceId - EmployeeService join-table id (null for unassigned)
   * @param durationOptionId  - chosen ServiceDurationOption; null = use isDefault
   * @param bookingType - booking type for option lookup when durationOptionId is null
   */
  async resolve(params: {
    serviceId: string;
    employeeServiceId: string | null;
    durationOptionId: string | null;
    bookingType?: BookingType | null;
  }): Promise<ResolvedPrice> {
    const { serviceId, employeeServiceId, durationOptionId, bookingType } = params;

    // --- Step 1: resolve the ServiceDurationOption ---
    const durationOption = await this.resolveDurationOption({
      serviceId,
      durationOptionId,
      bookingType,
    });

    // --- Step 2: check for employee-level override ---
    let employeeOverride: { priceOverride: unknown; durationOverride: unknown } | null = null;
    if (employeeServiceId && durationOption) {
      employeeOverride = await this.prisma.employeeServiceOption.findFirst({
        where: {
          employeeServiceId,
          durationOptionId: durationOption.id,
          isActive: true,
        },
        select: { priceOverride: true, durationOverride: true },
      });
    }

    // --- Step 3: fall back to Service base values if no duration option ---
    if (!durationOption) {
      const service = await this.prisma.service.findUniqueOrThrow({
        where: { id: serviceId },
        select: { price: true, durationMins: true, currency: true, id: true },
      });
      return {
        price: Number(service.price),
        durationMins: service.durationMins,
        durationOptionId: '',
        currency: service.currency,
        isEmployeeOverride: false,
      };
    }

    const hasOverride =
      employeeOverride !== null &&
      (employeeOverride.priceOverride !== null || employeeOverride.durationOverride !== null);

    return {
      price:
        employeeOverride?.priceOverride !== null && employeeOverride?.priceOverride !== undefined
          ? Number(employeeOverride.priceOverride)
          : Number(durationOption.price),
      durationMins:
        employeeOverride?.durationOverride !== null &&
        employeeOverride?.durationOverride !== undefined
          ? Number(employeeOverride.durationOverride)
          : durationOption.durationMins,
      durationOptionId: durationOption.id,
      currency: durationOption.currency,
      isEmployeeOverride: hasOverride,
    };
  }

  private async resolveDurationOption(params: {
    serviceId: string;
    durationOptionId: string | null;
    bookingType?: BookingType | null;
  }) {
    const { serviceId, durationOptionId, bookingType } = params;

    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, serviceId, isActive: true },
        select: { id: true, price: true, durationMins: true, currency: true },
      });
    }

    // Try: default option scoped to this bookingType
    if (bookingType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, bookingType, isDefault: true, isActive: true },
        select: { id: true, price: true, durationMins: true, currency: true },
      });
      if (scoped) return scoped;
    }

    // Try: default option with no bookingType restriction (applies to all)
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, bookingType: null, isDefault: true, isActive: true },
      select: { id: true, price: true, durationMins: true, currency: true },
    });
    if (global) return global;

    // Last resort: first active option regardless of defaults
    return this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isActive: true },
      orderBy: [{ bookingType: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, price: true, durationMins: true, currency: true },
    });
  }
}
