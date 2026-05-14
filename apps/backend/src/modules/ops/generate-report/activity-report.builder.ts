import { PrismaService } from '../../../infrastructure/database';

export interface ActivityReportParams {
  from: Date;
  to: Date;
}

export interface ActivityReportResult {
  period: { from: string; to: string };
  summary: {
    totalActions: number;
    uniqueUsers: number;
    topEntities: Array<{ entity: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
  };
  byDay: Array<{ date: string; count: number }>;
  byUser: Array<{ userId: string; userEmail: string | null; count: number }>;
}

export async function buildActivityReport(
  prisma: PrismaService,
  params: ActivityReportParams,
): Promise<ActivityReportResult> {
  const { from, to } = params;

  const logs = await prisma.activityLog.findMany({
    where: {
      occurredAt: { gte: from, lte: to },
    },
    select: {
      userId: true,
      userEmail: true,
      action: true,
      entity: true,
      occurredAt: true,
    },
  });

  const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean)).size;

  // Top entities
  const entityMap = new Map<string, number>();
  const actionMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  const userMap = new Map<string, { userEmail: string | null; count: number }>();

  for (const log of logs) {
    entityMap.set(log.entity, (entityMap.get(log.entity) ?? 0) + 1);
    actionMap.set(log.action, (actionMap.get(log.action) ?? 0) + 1);

    const day = log.occurredAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

    if (log.userId) {
      const existing = userMap.get(log.userId);
      userMap.set(log.userId, {
        userEmail: log.userEmail,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalActions: logs.length,
      uniqueUsers,
      topEntities: [...entityMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([entity, count]) => ({ entity, count })),
      topActions: [...actionMap.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([action, count]) => ({ action, count })),
    },
    byDay: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    byUser: [...userMap.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .map(([userId, v]) => ({ userId, ...v })),
  };
}
