import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ClsService } from 'nestjs-cls';

/**
 * Daily reconciliation handler.
 *
 * Scans every active/trialing organization and re-derives the ground-truth
 * value for each quantitative usage key from source tables. When the stored
 * counter drifts from truth the counter is corrected and the discrepancy is
 * logged at WARN so on-call can audit.
 *
 * Org list is fetched under SUPER_ADMIN_CONTEXT_CLS_KEY (required for
 * prisma.$allTenants). Each org's counter reads/writes run inside a
 * cls.run() that sets TENANT_CLS_KEY so the tenant-scoping extension
 * auto-scopes UsageCounter queries correctly.
 */
@Injectable()
export class ReconcileUsageCountersHandler {
  private readonly logger = new Logger(ReconcileUsageCountersHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async execute(): Promise<{ orgsScanned: number; rowsRepaired: number }> {
    // Billing/usage counters removed in single-tenant mode
    return { orgsScanned: 0, rowsRepaired: 0 };
  }

}
