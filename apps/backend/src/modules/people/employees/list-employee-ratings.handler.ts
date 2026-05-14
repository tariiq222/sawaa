import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';

export interface ListEmployeeRatingsQuery {
  employeeId: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListEmployeeRatingsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListEmployeeRatingsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const where = { employeeId: query.employeeId };
    const [items, total] = await this.prisma.$transaction((tx) =>
      Promise.all([
        tx.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        tx.rating.count({ where }),
      ]),
    );

    return toListResponse(items, total, page, limit);
  }
}
