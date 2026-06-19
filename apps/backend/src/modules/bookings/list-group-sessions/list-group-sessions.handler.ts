import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListGroupSessionsDto } from './list-group-sessions.dto';

export type ListGroupSessionsQuery = ListGroupSessionsDto & {
  page: number;
  limit: number;
};

@Injectable()
export class ListGroupSessionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListGroupSessionsQuery) {
    const where: Record<string, unknown> = {};
    if (query.status) {
      where['status'] = query.status;
    }
    if (query.upcoming) {
      where['scheduledAt'] = { gte: new Date() };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.groupSession.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.groupSession.count({ where }),
    ]);

    const items = sessions.map((s) => ({
      id: s.id,
      ref: s.ref,
      title: s.title,
      scheduledAt: s.scheduledAt,
      durationMins: s.durationMins,
      maxCapacity: s.maxCapacity,
      enrolledCount: s.enrolledCount,
      price: Number(s.price),
      status: s.status,
      deliveryType: s.deliveryType,
      isPublic: s.isPublic,
      employeeId: s.employeeId,
      serviceId: s.serviceId,
      spotsLeft: s.maxCapacity - s.enrolledCount,
    }));

    return toListResponse(items, total, query.page, query.limit);
  }
}
