import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListActivityDto } from './list-activity.dto';

export type ListActivityCommand = ListActivityDto;

@Injectable()
export class ListActivityHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListActivityCommand) {
    const page = Math.max(1, cmd.page ?? 1);
    const limit = Math.min(100, cmd.limit ?? 50);
    const skip = (page - 1) * limit;

    const from = cmd.from ? new Date(cmd.from) : undefined;
    const to = cmd.to ? new Date(cmd.to) : undefined;

    const where = {
      ...(cmd.userId ? { userId: cmd.userId } : {}),
      ...(cmd.entity ? { entity: cmd.entity } : {}),
      ...(cmd.entityId ? { entityId: cmd.entityId } : {}),
      ...(cmd.action ? { action: cmd.action } : {}),
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const userIds = Array.from(
      new Set(items.map((i) => i.userId).filter((v): v is string => !!v)),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const shaped = items.map((it) => ({
      id: it.id,
      userId: it.userId,
      action: it.action,
      module: it.entity,
      resourceId: it.entityId,
      description: it.description,
      ipAddress: it.ipAddress,
      userAgent: it.userAgent,
      createdAt: it.occurredAt,
      userEmail: it.userEmail,
      user: it.userId ? (userById.get(it.userId) ?? null) : null,
    }));

    return toListResponse(shaped, total, page, limit);
  }
}
