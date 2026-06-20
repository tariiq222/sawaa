import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { normalizeDeliveryTypeInput } from '../delivery-type-input.helper';
import { SetEmployeeCustomPricingCommand } from './set-employee-custom-pricing.dto';

export { SetEmployeeCustomPricingCommand };

@Injectable()
export class SetEmployeeCustomPricingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: SetEmployeeCustomPricingCommand) {
    const link = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');
    const employeeServiceId = link.id;

    // Guard against the silent-write trap: this endpoint writes EmployeeServiceOption
    // overrides, which are only read in INHERIT mode. A practitioner in custom-pricing
    // (owned-rows) mode is priced exclusively from owned ServiceDurationOption rows, so
    // these writes would be silently ignored. Fail loudly instead of losing data.
    if (cmd.enabled !== false && link.useCustomPricing === true) {
      throw new BadRequestException(
        'Practitioner is in custom-pricing mode; set prices via the owned duration-options endpoint, not custom-pricing overrides',
      );
    }

    if (cmd.enabled === false) {
      await this.rlsTransaction.withTransaction((tx: any) =>
        tx.employeeServiceOption.updateMany({
          where: { employeeServiceId },
          data: { isActive: false },
        }),
      );
      return this.buildResult(employeeServiceId);
    }

    // enabled === true
    await this.rlsTransaction.withTransaction(async (tx: any) => {
      for (const entry of cmd.types) {
        const deliveryType = normalizeDeliveryTypeInput(entry.deliveryType);

        const config = await tx.serviceBookingConfig.findFirst({
          where: { serviceId: cmd.serviceId, deliveryType },
        });

        let anchor = await tx.serviceDurationOption.findFirst({
          where: { serviceId: cmd.serviceId, deliveryType, isActive: true, employeeServiceId: null },
          orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
        });

        if (!anchor) {
          anchor = await tx.serviceDurationOption.create({
            data: {
              serviceId: cmd.serviceId,
              deliveryType,
              label: `${entry.durationMins} min`,
              labelAr: `${entry.durationMins} دقيقة`,
              durationMins: config?.durationMins ?? entry.durationMins,
              price: config?.price ?? entry.price,
              currency: 'SAR',
              isDefault: true,
              sortOrder: 0,
              isActive: true,
            },
          });
        }

        await tx.employeeServiceOption.upsert({
          where: {
            employeeServiceId_durationOptionId_deliveryType: {
              employeeServiceId,
              durationOptionId: anchor.id,
              deliveryType,
            },
          },
          create: {
            employeeServiceId,
            durationOptionId: anchor.id,
            deliveryType,
            priceOverride: entry.price,
            durationOverride: entry.durationMins,
            isActive: true,
          },
          update: {
            priceOverride: entry.price,
            durationOverride: entry.durationMins,
            isActive: true,
          },
        });
      }

      // Deactivate options for delivery types NOT in the payload
      const sentTypes = cmd.types.map((t) => normalizeDeliveryTypeInput(t.deliveryType));
      await tx.employeeServiceOption.updateMany({
        where: { employeeServiceId, deliveryType: { notIn: sentTypes } },
        data: { isActive: false },
      });
    });

    return this.buildResult(employeeServiceId);
  }

  private async buildResult(employeeServiceId: string) {
    const options = await this.prisma.employeeServiceOption.findMany({
      where: { employeeServiceId },
      include: { durationOption: true },
    });
    const activeOptions = options.filter((o) => o.isActive);
    const hasCustomPricing = activeOptions.some(
      (o) => o.priceOverride !== null || o.durationOverride !== null,
    );
    const serviceTypes = activeOptions.map((o) => ({
      id: `${employeeServiceId}:${o.deliveryType}`,
      deliveryType: o.deliveryType,
      bookingType: o.deliveryType,
      price:
        o.priceOverride !== null ? Number(o.priceOverride) : Number(o.durationOption.price),
      durationMins:
        o.durationOverride !== null ? o.durationOverride : o.durationOption.durationMins,
      basePrice: Number(o.durationOption.price),
      baseDurationMins: o.durationOption.durationMins,
      isCustom: o.priceOverride !== null || o.durationOverride !== null,
      isActive: true,
    }));
    return { hasCustomPricing, serviceTypes };
  }
}
