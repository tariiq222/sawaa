import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import type { Rating } from '@prisma/client';
import { toListResponse, type ListResponse } from '../../../common/dto';

export interface ListEmployeeRatingsQuery {
  employeeId: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListEmployeeRatingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(query: ListEmployeeRatingsQuery): Promise<ListResponse<Rating> & {starCounts: Record<number, number>}> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const where = { employeeId: query.employeeId };
    const [items, total, distribution] = await this.rlsTransaction.withTransaction((tx) =>
      Promise.all([
        tx.rating.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        tx.rating.count({ where }),
        tx.rating.groupBy({by: ['score'], where, _count: {_all: true}}),
      ]),
    );

    const starCounts: Record<number, number> = {1:0,2:0,3:0,4:0,5:0};
    for (const group of distribution) starCounts[group.score] = group._count._all;
    return {...toListResponse(items, total, page, limit), starCounts};
  }
}
