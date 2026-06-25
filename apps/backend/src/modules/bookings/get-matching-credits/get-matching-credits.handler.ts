import { Injectable } from '@nestjs/common';
import { PackagePurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetMatchingCreditsDto } from './get-matching-credits.dto';

export type GetMatchingCreditsQuery = GetMatchingCreditsDto;

export interface MatchingCredit {
  creditId: string;
  purchaseId: string;
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  totalQuantity: number;
  usedQuantity: number;
  remaining: number;
  createdAt: Date;
}

/**
 * Return a client's ACTIVE session-package credits that match the exact
 * (service, employee, duration) triple and still have remaining capacity,
 * in FIFO order (oldest purchase first — the order they would be consumed).
 *
 * Read-only suggestion source for the dashboard booking wizard.
 */
@Injectable()
export class GetMatchingCreditsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMatchingCreditsQuery): Promise<MatchingCredit[]> {
    const credits = await this.prisma.packageCredit.findMany({
      where: {
        serviceId: query.serviceId,
        employeeId: query.employeeId,
        durationOptionId: query.durationOptionId,
        purchase: {
          clientId: query.clientId,
          status: PackagePurchaseStatus.ACTIVE,
        },
      },
      orderBy: [{ purchase: { createdAt: 'asc' } }, { createdAt: 'asc' }],
      select: {
        id: true,
        purchaseId: true,
        serviceId: true,
        employeeId: true,
        durationOptionId: true,
        totalQuantity: true,
        usedQuantity: true,
        createdAt: true,
      },
    });

    return credits
      .map((c) => ({
        creditId: c.id,
        purchaseId: c.purchaseId,
        serviceId: c.serviceId,
        employeeId: c.employeeId,
        durationOptionId: c.durationOptionId,
        totalQuantity: c.totalQuantity,
        usedQuantity: c.usedQuantity,
        remaining: c.totalQuantity - c.usedQuantity,
        createdAt: c.createdAt,
      }))
      .filter((c) => c.remaining > 0);
  }
}
