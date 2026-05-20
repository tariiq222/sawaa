import { Injectable, NotFoundException } from '@nestjs/common';
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
      // Upsert each config
      await Promise.all(cmd.types.map((t) => {
        const deliveryType = normalizeDeliveryTypeInput(t.deliveryType);
        return tx.serviceBookingConfig.upsert({
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
          },
          update: {
            price: t.price,
            durationMins: t.durationMins,
            isActive: t.isActive ?? true,
            updatedAt: new Date(),
          },
        });
      }));
    });

    return this.prisma.serviceBookingConfig.findMany({
      where: { serviceId: cmd.serviceId },
      orderBy: { deliveryType: 'asc' },
    });
  }
}
