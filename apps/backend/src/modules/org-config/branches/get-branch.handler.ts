import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetBranchQuery = { branchId: string };

@Injectable()
export class GetBranchHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GetBranchQuery) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId },
      include: {
        businessHours: { orderBy: { dayOfWeek: 'asc' } },
        holidays: { orderBy: { date: 'asc' } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }
}
