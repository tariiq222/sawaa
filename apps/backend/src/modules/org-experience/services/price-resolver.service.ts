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
   * Resolves final price + duration for a booking. The practitioner's pricing mode
   * (useCustomPricing) selects which rows are authoritative:
   *
   * CUSTOM mode — owned rows only:
   *   ServiceDurationOption where employeeServiceId = link.id. No overrides, no
   *   service-default / booking-config / base fallback. If none resolve → 400.
   *
   * INHERIT mode — service catalog, priority order:
   *   1. EmployeeServiceOption.priceOverride / durationOverride (per-employee override
   *      on a service-default option) scoped by employeeServiceId + deliveryType + durationOptionId
   *   2. ServiceDurationOption.price / durationMins (service-default option, employeeServiceId IS NULL)
   *   3. ServiceBookingConfig.price / durationMins (config-level price per deliveryType, isActive=true)
   *   4. Service.price / durationMins (final fallback)
   *
   * @param serviceId   - the service being booked
   * @param employeeServiceId - EmployeeService join-table id (null for unassigned)
   * @param durationOptionId  - chosen ServiceDurationOption; null = use isDefault/first
   * @param bookingType - appointment shape retained for callers; deliveryType scopes options
   * @param deliveryType - delivery channel for price scoping
   * @param useCustomPricing - the practitioner's pricing mode (source of truth)
   */
  async resolve(params: {
    serviceId: string;
    employeeServiceId: string | null;
    durationOptionId: string | null;
    bookingType?: BookingType | null;
    deliveryType?: DeliveryType | null;
    /**
     * The practitioner's pricing mode (EmployeeService.useCustomPricing). This is
     * the SINGLE SOURCE OF TRUTH for which rows are read — not an inference from
     * whether owned rows happen to exist:
     *   - custom  → price exclusively from the practitioner's OWNED ServiceDurationOption
     *               rows (employeeServiceId = link.id). EmployeeServiceOption overrides
     *               and service-default rows are never consulted.
     *   - inherit → service-default rows (employeeServiceId IS NULL) + EmployeeServiceOption
     *               overrides. Owned rows are never consulted.
     */
    useCustomPricing?: boolean;
  }): Promise<ResolvedPrice> {
    const { serviceId, employeeServiceId, durationOptionId, deliveryType } = params;
    const useCustomPricing = params.useCustomPricing ?? false;

    // --- Step 1: resolve the ServiceDurationOption (mode-scoped) ---
    const durationOption = await this.resolveDurationOption({
      serviceId,
      durationOptionId,
      deliveryType,
      employeeServiceId,
      useCustomPricing,
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

    // --- CUSTOM MODE: price exclusively from the practitioner's owned rows ---
    // No EmployeeServiceOption overrides, no service-default / booking-config / base fallback.
    if (useCustomPricing) {
      if (!durationOption) {
        throw new BadRequestException(
          'Practitioner has no custom pricing for the selected option',
        );
      }
      return {
        price: Number(durationOption.price),
        durationMins: durationOption.durationMins,
        durationOptionId: durationOption.id,
        currency: durationOption.currency,
        isEmployeeOverride: false,
      };
    }

    // --- INHERIT MODE (below) ---
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
   * Resolves a ServiceDurationOption for the booking. The row set is selected by
   * pricing mode — the two modes never read each other's rows:
   *
   * CUSTOM (useCustomPricing = true): only the practitioner's OWNED rows
   *   (employeeServiceId = link.id). An explicit durationOptionId must be one of
   *   them; otherwise null (and resolve() rejects). No service-default fallback.
   *
   * INHERIT (useCustomPricing = false): only service-default rows
   *   (employeeServiceId IS NULL). EmployeeServiceOption overrides are layered on
   *   top later in resolve(). Owned rows are never consulted.
   */
  private async resolveDurationOption(params: {
    serviceId: string;
    durationOptionId: string | null;
    employeeServiceId?: string | null;
    bookingType?: BookingType | null;
    deliveryType?: DeliveryType | null;
    useCustomPricing?: boolean;
  }) {
    const { serviceId, durationOptionId, deliveryType, employeeServiceId } = params;
    const useCustomPricing = params.useCustomPricing ?? false;
    const SELECT = { id: true, price: true, durationMins: true, currency: true, serviceId: true, deliveryType: true } as const;

    // ── CUSTOM MODE: only the practitioner's OWNED rows (employeeServiceId = link.id) ──
    if (useCustomPricing && employeeServiceId) {
      if (durationOptionId) {
        // An explicit option must be one of the practitioner's owned rows.
        return this.prisma.serviceDurationOption.findFirst({
          where: { id: durationOptionId, serviceId, employeeServiceId, isActive: true },
          select: SELECT,
        });
      }
      if (deliveryType) {
        const ownedScoped = await this.prisma.serviceDurationOption.findFirst({
          where: { serviceId, deliveryType, employeeServiceId, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
          select: SELECT,
        });
        if (ownedScoped) return ownedScoped;
      }
      // No service-default fallback in custom mode — owned rows only.
      return this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, employeeServiceId, isActive: true },
        orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
        select: SELECT,
      });
    }

    // ── INHERIT MODE: only service-default rows (employeeServiceId IS NULL) ──
    if (durationOptionId) {
      return this.prisma.serviceDurationOption.findFirst({
        where: { id: durationOptionId, serviceId, employeeServiceId: null, isActive: true },
        select: SELECT,
      });
    }

    // Try: default option scoped to this deliveryType.
    if (deliveryType) {
      const scoped = await this.prisma.serviceDurationOption.findFirst({
        where: { serviceId, deliveryType, isDefault: true, isActive: true, employeeServiceId: null },
        select: SELECT,
      });
      if (scoped) return scoped;
    }

    // Try: any default option for the service.
    const global = await this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isDefault: true, isActive: true, employeeServiceId: null },
      select: SELECT,
    });
    if (global) return global;

    // Last resort: first active service-default option regardless of defaults
    return this.prisma.serviceDurationOption.findFirst({
      where: { serviceId, isActive: true, employeeServiceId: null },
      orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      select: SELECT,
    });
  }
}
