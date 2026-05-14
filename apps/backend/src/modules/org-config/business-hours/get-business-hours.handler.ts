import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetBusinessHoursQuery = { branchId: string };

@Injectable()
export class GetBusinessHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GetBusinessHoursQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.businessHour.findMany({
      where: { branchId: dto.branchId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
