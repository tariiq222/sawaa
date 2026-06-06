import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { SetBusinessHoursDto } from './set-business-hours.dto';
import { BUSINESS_HOURS_CACHE_PREFIX } from './business-hours.cache';

export type SetBusinessHoursCommand = SetBusinessHoursDto;

@Injectable()
export class SetBusinessHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly cache: CacheService,
  ) {}

  async execute(dto: SetBusinessHoursCommand) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    for (const slot of dto.schedule) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException(`Invalid dayOfWeek: ${slot.dayOfWeek}`);
      }
    }

    await this.rlsTransaction.withTransaction((tx) =>
      Promise.all(dto.schedule.map((slot) =>
        tx.businessHour.upsert({
          where: { branchId_dayOfWeek: { branchId: dto.branchId, dayOfWeek: slot.dayOfWeek } },
          create: {
            branchId: dto.branchId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOpen: slot.isOpen,
          },
          update: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOpen: slot.isOpen,
          },
        }),
      )),
    );

    await this.cache.invalidatePrefix(`${BUSINESS_HOURS_CACHE_PREFIX}${dto.branchId}`);

    return this.prisma.businessHour.findMany({
      where: { branchId: dto.branchId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
