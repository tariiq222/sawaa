import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

/**
 * Daily reconciliation handler.
 *
 * Usage counters removed in single-tenant mode — returns zeros.
 */
@Injectable()
export class ReconcileUsageCountersHandler {
  private readonly logger = new Logger(ReconcileUsageCountersHandler.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(): Promise<{ orgsScanned: number; rowsRepaired: number }> {
    // Billing/usage counters removed in single-tenant mode
    return { orgsScanned: 0, rowsRepaired: 0 };
  }

}
