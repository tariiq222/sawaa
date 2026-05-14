import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
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
 * Uses cls.run() + SUPER_ADMIN_CONTEXT_CLS_KEY to access prisma.$allTenants
 * outside of the HTTP request lifecycle.
 */
@Injectable()
export class RunOrphanAuditHandler {
  private readonly logger = new Logger(RunOrphanAuditHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<void> {
    // Wrap in a super-admin CLS context so prisma.$allTenants is accessible.
    await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      this.logger.log('systemContext: orphan-audit tick');
      await this.runAudit();
    });
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
    // Access the child model dynamically via $allTenants (bypasses tenant scoping).
    const childModel = (this.prisma.$allTenants as unknown as Record<string, unknown>)[
      check.childModel
    ] as {
      findMany: (args: unknown) => Promise<Array<Record<string, string>>>;
    };

    const candidates = await childModel.findMany({
      select: { id: true, [check.childField]: true },
      distinct: [check.childField],
    });

    let orphansFound = 0;

    for (const candidate of candidates) {
      const refId = candidate[check.childField];
      if (!refId) continue; // nullable field, skip nulls

      const parentModel = (this.prisma.$allTenants as unknown as Record<string, unknown>)[
        check.parentModel
      ] as {
        findFirst: (args: unknown) => Promise<Record<string, string> | null>;
      };

      const parent = await parentModel.findFirst({
        where: { id: refId },
        select: { id: true },
      });

      if (!parent) {
        orphansFound++;
        await this.writeOrphanLog(check, candidate['id'], refId);
      }
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
    await this.prisma.$allTenants.activityLog.create({
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
