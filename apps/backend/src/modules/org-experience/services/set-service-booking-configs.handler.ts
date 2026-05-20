import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetServiceBookingConfigsDto } from './set-service-booking-configs.dto';
import { normalizeDeliveryTypeInput } from './delivery-type-input.helper';

export type SetServiceBookingConfigsCommand = SetServiceBookingConfigsDto & {
  serviceId: string;
};

@Injectable()
export class SetServiceBookingConfigsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: SetServiceBookingConfigsCommand) {
    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId },
    });
    if (!service) throw new NotFoundException('Service not found');

    for (const type of cmd.types) {
      for (const window of type.availabilityWindows ?? []) {
        if (window.startTime >= window.endTime) {
          throw new BadRequestException('Availability window startTime must be before endTime');
        }
      }
    }

    // Validate that any provided durationOption ids belong to this service.
    // Prevents an attacker from passing a foreign service's option id and overwriting it.
    const providedOptionIds = cmd.types
      .flatMap((t) => t.durationOptions ?? [])
      .map((o) => o.id)
      .filter((id): id is string => !!id);

    if (providedOptionIds.length > 0) {
      const existing = await this.prisma.serviceDurationOption.findMany({
        where: { id: { in: providedOptionIds } },
        select: { id: true, serviceId: true },
      });
      const foreign = existing.filter((o) => o.serviceId !== cmd.serviceId);
      if (foreign.length > 0) {
        throw new BadRequestException(
          `Duration option(s) do not belong to this service: ${foreign.map((o) => o.id).join(', ')}`,
        );
      }
      if (existing.length !== providedOptionIds.length) {
        throw new BadRequestException('One or more duration option ids do not exist');
      }
    }

    // Upsert each booking type config; delete types not included in the payload.
    await this.rlsTransaction.withTransaction(async (tx) => {
      const deliveryTypes = cmd.types.map((t) => normalizeDeliveryTypeInput(t.deliveryType));

      // Remove configs for delivery channels not present in the new payload.
      await tx.serviceBookingConfig.deleteMany({
        where: {
          serviceId: cmd.serviceId,
          deliveryType: { notIn: deliveryTypes },
        },
      });
      await Promise.all(cmd.types.map(async (t) => {
        const deliveryType = normalizeDeliveryTypeInput(t.deliveryType);
        await tx.serviceBookingConfig.upsert({
          where: {
            serviceId_deliveryType: {
              serviceId: cmd.serviceId,
              deliveryType,
            },
          },
          create: {
            id: randomUUID(),
            serviceId: cmd.serviceId,
            deliveryType,
            price: t.price,
            durationMins: t.durationMins,
            isActive: t.isActive ?? true,
            useCustomAvailability: t.useCustomAvailability ?? false,
          },
          update: {
            price: t.price,
            durationMins: t.durationMins,
            isActive: t.isActive ?? true,
            useCustomAvailability: t.useCustomAvailability ?? false,
            updatedAt: new Date(),
          },
        });

        if (t.durationOptions) {
          const optionIds = t.durationOptions.map((o) => o.id).filter((id): id is string => !!id);
          await tx.serviceDurationOption.deleteMany({
            where: {
              serviceId: cmd.serviceId,
              deliveryType,
              ...(optionIds.length > 0 ? { id: { notIn: optionIds } } : {}),
            },
          });
          await Promise.all(t.durationOptions.map((option, index) => (
            option.id
              ? tx.serviceDurationOption.updateMany({
                  // Defence-in-depth: compound where ensures we can never mutate
                  // a duration option that belongs to a different service even if
                  // the upstream validation is bypassed.
                  where: { id: option.id, serviceId: cmd.serviceId },
                  data: {
                    deliveryType,
                    label: option.label,
                    labelAr: option.labelAr ?? option.label,
                    durationMins: option.durationMins,
                    price: option.price,
                    currency: option.currency ?? 'SAR',
                    isDefault: option.isDefault ?? false,
                    sortOrder: option.sortOrder ?? index,
                    isActive: option.isActive ?? true,
                  },
                })
              : tx.serviceDurationOption.create({
                  data: {
                    serviceId: cmd.serviceId,
                    deliveryType,
                    label: option.label,
                    labelAr: option.labelAr ?? option.label,
                    durationMins: option.durationMins,
                    price: option.price,
                    currency: option.currency ?? 'SAR',
                    isDefault: option.isDefault ?? false,
                    sortOrder: option.sortOrder ?? index,
                    isActive: option.isActive ?? true,
                  },
                })
          )));
        }

        await tx.serviceAvailabilityWindow.deleteMany({
          where: { serviceId: cmd.serviceId, deliveryType },
        });
        if (t.useCustomAvailability && t.availabilityWindows?.length) {
          await tx.serviceAvailabilityWindow.createMany({
            data: t.availabilityWindows.map((window) => ({
              id: randomUUID(),
              serviceId: cmd.serviceId,
              deliveryType,
              dayOfWeek: window.dayOfWeek,
              startTime: window.startTime,
              endTime: window.endTime,
              isActive: window.isActive ?? true,
            })),
          });
        }
      }));
    });

    return this.findConfigs(cmd.serviceId);
  }

  private async findConfigs(serviceId: string) {
    const [configs, durationOptions, availabilityWindows] = await Promise.all([
      this.prisma.serviceBookingConfig.findMany({
        where: { serviceId },
        orderBy: { deliveryType: 'asc' },
      }),
      this.prisma.serviceDurationOption.findMany({
        where: { serviceId },
        orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.serviceAvailabilityWindow.findMany({
        where: { serviceId },
        orderBy: [{ deliveryType: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
    ]);

    return configs.map((config) => ({
      ...config,
      durationOptions: durationOptions.filter((option) => option.deliveryType === config.deliveryType),
      availabilityWindows: availabilityWindows.filter((window) => window.deliveryType === config.deliveryType),
    }));
  }
}
