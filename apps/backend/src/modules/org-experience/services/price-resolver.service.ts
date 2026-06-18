import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { BookingType, DeliveryType } from '@prisma/client';

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
   *    scoped by employeeServiceId + deliveryType + durationOptionId
   * 2. ServiceDurationOption.price / durationMins (catalog option)
   *    scoped by deliveryType
   * 3. ServiceBookingConfig.price / durationMins (config-level price per deliveryType)
   *    scoped by serviceId + deliveryType + isActive=true
   * 4. Service.price / durationMins (final fallback)
   *
   * @param serviceId   - the service being booked
   * @param employeeServiceId - EmployeeService join-table id (null for unassigned)
   * @param durationOptionId  - chosen ServiceDurationOption; null = use isDefault
   * @param bookingType - appointment shape retained for callers; deliveryType scopes options
   * @param deliveryType - delivery channel for price scoping
   */
  async resolve(params: {
    serviceId: string;
    employeeServiceId: string | null;
    durationOptionId: string | null;
    bookingType?: BookingType | null;
    deliveryType?: DeliveryType | null;
  }): Promise<ResolvedPrice> {
    const { serviceId, employeeServiceId, durationOptionId, deliveryType } = params;

    // --- Step 1: resolve the ServiceDurationOption ---
    const durationOption = await this.resolveDurationOption({
      serviceId,
      durationOptionId,
      deliveryType,
      employeeServiceId,
    });

    // Validate that the explicitly-provided duration option matches the service and delivery type
    if (durationOptionId && durationOption) {
      if (durationOption.serviceId !== serviceId) {
        throw new BadRequestException('Duration option does not belong to the selected service');
      }
      if (deliveryType && durationOption.deliveryType && durationOption.deliveryType !== deliveryType) {
        throw new BadRequestException(
          `Duration option delivery type (${durationOption.deliveryType}) does not match requested delivery type (${deliveryType})`,
        );
      }
    }

    // --- Step 2: check for employee-level override scoped by deliveryType ---
    let employeeOverride: { priceOverride: unknown; durationOverride: unknown } | null = null;
    if (employeeServiceId && durationOption) {
      const where: Record<string, unknown> = {
        employeeServiceId,
        durationOptionId: durationOption.id,
        isActive: true,
      };
      if (deliveryType) {
        where.deliveryType = deliveryType;
      }
      employeeOverride = await this.prisma.employeeServiceOption.findFirst({
        where,
        select: { priceOverride: true, durationOverride: true },
      });
    }

    // --- Step 3: fall back to ServiceBookingConfig or Service base values if no duration option ---
    if (!durationOption) {
      const service = await this.prisma.service.findUniqueOrThrow({
        where: { id: serviceId },
        select: { price: true, durationMins: true, currency: true, id: true },
      });

      // Step 3a: check ServiceBookingConfig for a config-level price scoped by deliveryType
      if (deliveryType) {
        const bookingConfig = await this.prisma.serviceBookingConfig.findFirst({
          where: { serviceId, deliveryType, isActive: true },
          select: { price: true, durationMins: true },
        });
        if (bookingConfig) {
          return {
            price: Number(bookingConfig.price),
            durationMins: bookingConfig.durationMins,
            durationOptionId: '',
            currency: service.currency,
            isEmployeeOverride: false,
          };
        }
      }

      // Step 3b: final fallback to Service.price / durationMins
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

  /**
   * Resolves a ServiceDurationOption for the booking, applying two-tier precedence:
   *
   * TIER 1 — Employee-owned rows (employeeServiceId IS NOT NULL):
   *   If the employee has their own active ServiceDurationOption rows for this
   *   (service, deliveryType), those rows REPLACE the service defaults entirely.
   *   These are distinct from EmployeeServiceOption overrides — they are separate
   *   option rows, not price/duration tweaks on a shared catalog option.
   *
   * TIER 2 — Service-default rows (employeeServiceId IS NULL):
   *   Standard catalog rows shared across all employees offering the service.
   *   Only used when the employee has no owned rows for the deliveryType.
   *
   * NOTE ON NON-COMPETITION: EmployeeServiceOption (price/duration override on a
   * specific catalog option) and employee-owned ServiceDurationOption rows (TIER 1)
   * do NOT compete. An EmployeeServiceOption always references a specific
   * durationOptionId. If the resolver picks up a TIER 1 owned row, that row's ID
   * will not match any EmployeeServiceOption linked to the service defaults,
   * so the override lookup in Step 2 of resolve() will correctly return null.
   */
  private async resolveDurationOption(params: {
    serviceId: string;
    durationOptionId: string | null;
    employeeServiceId?: string | null;
    bookingType?: BookingType | null;
    deliveryType?: DeliveryType | null;
  }) {
    const { serviceId, durationOptionId, deliveryType, employeeServiceId } = params;

    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, serviceId, isActive: true },
        select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
      });
    }

    // TIER 1: prefer employee-owned rows when available.
    // An employee can define their own ServiceDurationOption rows (employeeServiceId = link.id).
    // When own active rows exist for the requested deliveryType, use them exclusively —
    // they replace service defaults for this employee.
    if (employeeServiceId) {
      if (deliveryType) {
        const ownedScoped = await this.prisma.serviceDurationOption.findFirst({
          where: { serviceId, deliveryType, employeeServiceId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }],
          select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
        });
        if (ownedScoped) return ownedScoped;
      }

      const ownedGlobal = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, employeeServiceId, isActive: true },
        orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
        select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
      });
      if (ownedGlobal) return ownedGlobal;
    }

    // TIER 2: service-default rows (employeeServiceId IS NULL).
    // Try: default option scoped to this deliveryType.
    if (deliveryType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, deliveryType, isDefault: true, isActive: true, employeeServiceId: null },
        select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
      });
      if (scoped) return scoped;
    }

    // Try: any default option for the service.
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isDefault: true, isActive: true, employeeServiceId: null },
      select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
    });
    if (global) return global;

    // Last resort: first active service-default option regardless of defaults
    return this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isActive: true, employeeServiceId: null },
      orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true },
    });
  }
}
