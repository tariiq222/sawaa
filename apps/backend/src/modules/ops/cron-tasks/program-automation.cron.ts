import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

const CRON_ACTOR_EMAIL = 'system:program-automation-cron';
const BATCH_SIZE = 100;

/**
 * ProgramAutomationCron
 * =====================
 * Closes SCHEDULED programs once `startDate + daysCount` has elapsed,
 * transitioning them to COMPLETED and writing an audit row per program.
 *
 * Commits A and B introduce this cron as a stub so the existing job
 * registration keeps compiling; commit D fills in the program-specific
 * conditions (computed `endDate = startDate + daysCount days`).
 */
@Injectable()
export class ProgramAutomationCron {
  private readonly logger = new Logger(ProgramAutomationCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    const now = new Date();
    const targets = await this.prisma.program.findMany({
      where: { status: 'SCHEDULED', startDate: { lte: now } },
      select: { id: true, startDate: true, daysCount: true },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
    });
    if (targets.length === 0) return;

    const ids = targets.map((t) => t.id);
    const result = await this.prisma.program.updateMany({
      where: { id: { in: ids }, status: 'SCHEDULED' },
      data: { status: 'COMPLETED' },
    });

    if (result.count > 0) {
      await this.prisma.activityLog.createMany({
        data: targets.map((t) => ({
          userEmail: CRON_ACTOR_EMAIL,
          action: ActivityAction.SYSTEM,
          entity: 'Program',
          entityId: t.id,
          description: 'Auto-completed: end date passed',
        })),
      });
      this.logger.log(`closed ${result.count} programs`);
    }
  }
}
