import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { ListHolidaysDto } from './list-holidays.dto';

export type ListHolidaysQuery = ListHolidaysDto;

@Injectable()
export class ListHolidaysHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: ListHolidaysQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const where: Record<string, unknown> = { branchId: dto.branchId };
    if (dto.year) {
      where['date'] = {
        gte: new Date(`${dto.year}-01-01`),
        lte: new Date(`${dto.year}-12-31`),
      };
    }

    return this.prisma.holiday.findMany({ where, orderBy: { date: 'asc' } });
  }
}
