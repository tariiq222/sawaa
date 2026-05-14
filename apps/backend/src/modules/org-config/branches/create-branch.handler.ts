import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

import { BranchCreatedEvent } from '../events/branch-created.event';
import { CreateBranchDto } from './create-branch.dto';

export type CreateBranchCommand = CreateBranchDto;

@Injectable()
export class CreateBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly rlsTx: RlsTransactionService,
  ) {}

  async execute(dto: CreateBranchCommand) {
    const branch = await this.rlsTx.withTransaction(
      async (tx) => {
        const existing = await tx.branch.findFirst({
          where: { nameAr: dto.nameAr },
        });
        if (existing) throw new ConflictException('Branch with this Arabic name already exists');

        if (dto.isMain === true) {
          await tx.branch.updateMany({
            where: { isMain: true },
            data: { isMain: false },
          });
        }

        const created = await tx.branch.create({
          data: {
            nameAr: dto.nameAr,
            nameEn: dto.nameEn,
            phone: dto.phone,
            addressAr: dto.addressAr,
            addressEn: dto.addressEn,
            city: dto.city,
            country: dto.country ?? 'SA',
            latitude: dto.latitude,
            longitude: dto.longitude,
            isActive: dto.isActive,
            isMain: dto.isMain,
            timezone: dto.timezone,
          },
        });

        return created;
      },
      { isolationLevel: 'Serializable' },
    );

    const event = new BranchCreatedEvent({ branchId: branch.id });
    this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => {});

    return branch;
  }
}
