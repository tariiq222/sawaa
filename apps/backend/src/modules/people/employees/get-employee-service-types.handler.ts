import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetEmployeeServiceTypesQuery {
  employeeId: string;
  serviceId: string;
}

/**
 * Resolves the bookable (type, duration-options) matrix for a specific
 * employee-service pair, consumed by the dashboard create-booking wizard.
 *
 * Source of truth:
 *   ServiceBookingConfig  — which delivery channels are active for this service.
 *   ServiceDurationOption — per-service duration variants, optionally
 *                           scoped to a delivery channel.
 *   EmployeeServiceOption — employee-level price/duration overrides on
 *                           ServiceDurationOption.
 */
@Injectable()
export class GetEmployeeServiceTypesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetEmployeeServiceTypesQuery) {
    const link = await this.prisma.employeeService.findFirst({
      where: { employeeId: query.employeeId, serviceId: query.serviceId },
    });
    if (!link) throw new NotFoundException('Employee-service link not found');

    const [configs, durationOptions, employeeOverrides] = await Promise.all([
      this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: query.serviceId, isActive: true },
        orderBy: { deliveryType: 'asc' },
      }),
      this.prisma.serviceDurationOption.findMany({
        where: { serviceId: query.serviceId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { durationMins: 'asc' }],
      }),
      this.prisma.employeeServiceOption.findMany({
        where: { employeeServiceId: link.id, isActive: true },
      }),
    ]);

    const useCustomPricing = link.useCustomPricing ?? false;
    const overrideByDurationId = new Map(
      employeeOverrides.map((o) => [o.durationOptionId, o]),
    );

    return configs.map((cfg) => {
      // Mode is the source of truth: custom → owned rows only (no overrides);
      // inherit → service-default rows only (overrides layered on top).
      const scoped = durationOptions.filter(
        (d) =>
          d.deliveryType === cfg.deliveryType &&
          (useCustomPricing ? d.employeeServiceId === link.id : !d.employeeServiceId),
      );
      const ownedDefault = useCustomPricing
        ? (scoped.find((d) => d.isDefault) ?? scoped[0])
        : undefined;

      return {
        id: `${link.id}:${cfg.deliveryType}`,
        employeeServiceId: link.id,
        deliveryType: cfg.deliveryType,
        /** @deprecated deliveryType is the source of truth. */
        bookingType: cfg.deliveryType,
        price: ownedDefault ? Number(ownedDefault.price) : Number(cfg.price),
        duration: ownedDefault ? ownedDefault.durationMins : cfg.durationMins,
        useCustomOptions: scoped.length > 0,
        isActive: cfg.isActive,
        durationOptions: scoped.map((d) => {
          // Overrides only apply in inherit mode.
          const ov = useCustomPricing ? undefined : overrideByDurationId.get(d.id);
          return {
            id: d.id,
            employeeServiceTypeId: `${link.id}:${cfg.deliveryType}`,
            label: d.label,
            labelAr: d.labelAr,
            durationMinutes: ov?.durationOverride ?? d.durationMins,
            price: Number(ov?.priceOverride ?? d.price),
            isDefault: d.isDefault,
            sortOrder: d.sortOrder,
            isActive: d.isActive,
          };
        }),
      };
    });
  }
}
