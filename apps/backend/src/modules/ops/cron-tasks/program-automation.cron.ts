import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction, ProgramStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

const CRON_ACTOR_EMAIL = 'system:program-automation-cron';
const BATCH_SIZE = 100;

/**
 * ProgramAutomationCron
 * =====================
 * Closes SCHEDULED programs once their full duration has elapsed. A
 * program's effective endDate is `startDate + daysCount` days; once the
 * current time passes that boundary, the program transitions to
 * COMPLETED (terminal status) and an audit row is written per program.
 *
 * Runs on the same 30-minute cadence as the legacy group-session automation.
 */
@Injectable()
export class ProgramAutomationCron {
  private readonly logger = new Logger(ProgramAutomationCron.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    const now = new Date();

    // Snapshot candidate ids + dates so we can compute endDate per row and
    // run the guarded update against the same snapshot.
    const candidates = await this.prisma.program.findMany({
      where: { status: ProgramStatus.SCHEDULED, startDate: { not: null } },
      select: { id: true, startDate: true, daysCount: true },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
    });

    const targets = candidates.filter((p) =>
      ProgramAutomationCron.hasEnded(p.startDate, p.daysCount, now),
    );
    if (targets.length === 0) return;

    const ids = targets.map((t) => t.id);
    const result = await this.prisma.program.updateMany({
      where: { id: { in: ids }, status: ProgramStatus.SCHEDULED },
      data: { status: ProgramStatus.COMPLETED },
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

  /**
   * True when `startDate + daysCount` days has elapsed relative to `now`.
   * Computed as plain Date arithmetic (no timezone gymnastics) because the
   * stored startDate is already a UTC instant.
   */
  static hasEnded(startDate: Date | null, daysCount: number, now: Date): boolean {
    if (!startDate) return false;
    const endDate = new Date(startDate.getTime() + daysCount * 86_400_000);
    return endDate.getTime() <= now.getTime();
  }
}
