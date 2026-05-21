import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

const CRON_ACTOR_EMAIL = 'system:group-session-automation-cron';

@Injectable()
export class GroupSessionAutomationCron {
  private readonly logger = new Logger(GroupSessionAutomationCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    const now = new Date();
    // Snapshot ids first so we can emit per-session audit rows.
    const targets = await this.prisma.groupSession.findMany({
      where: { status: 'OPEN', scheduledAt: { lte: now } },
      select: { id: true },
    });
    if (targets.length === 0) return;

    const ids = targets.map((t) => t.id);
    const result = await this.prisma.groupSession.updateMany({
      where: { id: { in: ids }, status: 'OPEN' },
      data: { status: 'COMPLETED' },
    });

    if (result.count > 0) {
      // Audit trail: ActivityLog with SYSTEM action so /activity-log surfaces
      // cron-driven state changes alongside user actions.
      await this.prisma.activityLog.createMany({
        data: targets.map((t) => ({
          userEmail: CRON_ACTOR_EMAIL,
          action: ActivityAction.SYSTEM,
          entity: 'GroupSession',
          entityId: t.id,
          description: 'Auto-completed: scheduled time passed',
        })),
      });
      this.logger.log(`closed ${result.count} group sessions`);
    }
  }
}
