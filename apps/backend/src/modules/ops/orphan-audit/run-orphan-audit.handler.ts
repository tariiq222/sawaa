import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ORPHAN_CHECKS, OrphanCheck } from './orphan-audit.types';

/**
 * DB-13 — Orphan-audit handler.
 *
 * Detects rows in cross-BC tables (Booking, Invoice, Rating) whose string FK
 * fields point to nonexistent parent records (Client, Employee, Service, Branch).
 *
 * DETECTION ONLY — no rows are deleted or modified. All findings are written
 * to ActivityLog (action=SYSTEM, entity='orphan_audit') for owner review.
 *
 * Runs on the BullMQ `ops-cron` queue, weekly cadence.
 */
@Injectable()
export class RunOrphanAuditHandler {
  private readonly logger = new Logger(RunOrphanAuditHandler.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<void> {
    this.logger.log('orphan-audit tick');
    await this.runAudit();
  }

  private async runAudit(): Promise<void> {
    this.logger.log(`DB-13 orphan audit starting`);
    const totalOrphans = await this.auditAll();
    this.logger.log(
      `DB-13 orphan audit complete — ${totalOrphans} orphans found`,
    );
  }

  private async auditAll(): Promise<number> {
    let count = 0;

    for (const check of ORPHAN_CHECKS) {
      count += await this.runCheck(check);
    }

    return count;
  }

  private async runCheck(check: OrphanCheck): Promise<number> {
    const childModel = (this.prisma as unknown as Record<string, unknown>)[
      check.childModel
    ] as {
      findMany: (args: unknown) => Promise<Array<Record<string, string>>>;
    };

    const candidates = await childModel.findMany({
      select: { id: true, [check.childField]: true },
      distinct: [check.childField],
    });

    let orphansFound = 0;

    // Collect all distinct, non-null referenced ids, then resolve which ones
    // actually exist in ONE findMany per check (was an N+1 findFirst per row),
    // and diff the missing ids in memory.
    const refIds = [
      ...new Set(
        candidates
          .map((candidate) => candidate[check.childField])
          .filter((refId): refId is string => Boolean(refId)),
      ),
    ];

    if (refIds.length === 0) {
      return 0;
    }

    const parentModel = (this.prisma as unknown as Record<string, unknown>)[
      check.parentModel
    ] as {
      findMany: (args: unknown) => Promise<Array<Record<string, string>>>;
    };

    const existingParents = await parentModel.findMany({
      where: { id: { in: refIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingParents.map((p) => p.id));

    for (const candidate of candidates) {
      const refId = candidate[check.childField];
      if (!refId) continue; // nullable field, skip nulls
      if (existingIds.has(refId)) continue;

      orphansFound++;
      await this.writeOrphanLog(check, candidate['id'], refId);
    }

    if (orphansFound > 0) {
      this.logger.warn(
        `check="${check.label}" orphans=${orphansFound}`,
      );
    }

    return orphansFound;
  }

  private async writeOrphanLog(
    check: OrphanCheck,
    childId: string,
    missingParentId: string,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.SYSTEM,
        entity: 'orphan_audit',
        entityId: childId,
        description: `Orphan detected: ${check.label}`,
        metadata: {
          check: check.label,
          childModel: check.childModel,
          childId,
          childField: check.childField,
          parentModel: check.parentModel,
          missingParentId,
        },
      },
    });
  }
}
