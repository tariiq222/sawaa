import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListProblemReportsDto } from './list-problem-reports.dto';

export type ListProblemReportsQuery = ListProblemReportsDto;

@Injectable()
export class ListProblemReportsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListProblemReportsQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      this.prisma.problemReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.problemReport.count({ where }),
    ]);
    return toListResponse(items, total, page, limit);
  }
}
